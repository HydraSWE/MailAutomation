import hashlib
import hmac
import json
import secrets
import time
import uuid
from base64 import urlsafe_b64encode
from datetime import timedelta
from decimal import Decimal, ROUND_UP
from typing import Any, cast
from urllib.parse import quote

import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, models, transaction
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError

from common.models import Organization
from ..models import (
    CheckoutEmailVerification, CheckoutSession, FreePlanClaim, InvoiceAccessCode, PaymentInvoice,
    PaymentSecurityAuditEvent, PaymentTransferLedger, Plan, PreCheckoutSession, Subscription,
)
from ..configuration import get_runtime_billing_configuration

User = get_user_model()


ACTIVE_INVOICE_STATUSES = (
    PaymentInvoice.Status.PENDING,
    PaymentInvoice.Status.VERIFYING,
)

CUSTOM_PLAN_SLUG = "custom"
PREMIUM_PLUS_PLAN_SLUG = "premium-plus"
CUSTOM_AUTO_LIMITS = {
    "email_limit": 1_000_000,
    "max_admins": 25,
    "max_users": 250,
    "max_smtp_accounts": 40,
    "max_recipients": 200_000,
}
CUSTOM_ADDON_PRICES = {
    "email_10k": 120,
    "admin": 150,
    "user": 20,
    "smtp_inbox": 300,
    "recipient_10k": 100,
}

DECIMALS_BY_NETWORK = {
    "bsc": 18,
    "ethereum": 6,
    "tron": 6,
    "ton": 6,
}


class InvoiceConflict(APIException):
    status_code = 409
    default_code = "invoice_conflict"


from common.utils import get_client_ip


def client_ip(request):
    return get_client_ip(request)


def private_hash(value):
    return hmac.new(settings.SECRET_KEY.encode(), value.strip().lower().encode(), hashlib.sha256).hexdigest()


def invoice_token_digest(token):
    return hmac.new(settings.SECRET_KEY.encode(), token.encode(), hashlib.sha256).hexdigest()


def checkout_cookie_name(base_name):
    return f"__Host-{base_name}" if settings.CHECKOUT_SESSION_COOKIE_SECURE else base_name


def normalized_email(value):
    raw = (value or "").strip().lower()
    if "@" not in raw:
        return raw
    local_part, domain = raw.split("@", 1)
    local_part = local_part.split("+", 1)[0]
    if domain in {"gmail.com", "googlemail.com"}:
        local_part = local_part.replace(".", "")
        domain = "gmail.com"
    return f"{local_part}@{domain}"


def normalized_org_name(value):
    return " ".join((value or "").strip().lower().split())


def amount_to_raw(amount, decimals):
    return (Decimal(amount) * (Decimal(10) ** int(decimals))).quantize(Decimal("1"))


def audit_event(event_type, *, invoice=None, ledger=None, actor=None, request=None, metadata=None):
    PaymentSecurityAuditEvent.objects.create(
        event_type=event_type,
        invoice=invoice,
        ledger=ledger,
        actor=actor if getattr(actor, "is_authenticated", False) else None,
        ip_hash=private_hash(client_ip(request)) if request else "",
        metadata=metadata or {},
    )



__all__ = [name for name in globals() if not name.startswith('__')]

