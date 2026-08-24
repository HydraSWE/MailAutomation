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


def audit_event(event_type, *, invoice=None, quote=None, ledger=None, actor=None, request=None, metadata=None):
    PaymentSecurityAuditEvent.objects.create(
        event_type=event_type,
        invoice=invoice,
        quote=quote,
        ledger=ledger,
        actor=actor if getattr(actor, "is_authenticated", False) else None,
        ip_hash=private_hash(client_ip(request)) if request else "",
        metadata=metadata or {},
    )




def mask_organization_name(org_name: str) -> str:
    if not org_name:
        return "an existing workspace"
    clean = org_name.strip()
    if len(clean) <= 3:
        return f"{clean[0]}***"
    return f"{clean[:2]}***{clean[-2:]}"


def check_account_available_for_signup(email: str, org_name: str | None = None):
    norm = normalized_email(email)
    existing_user = (
        User.objects.filter(email__iexact=norm)
        .select_related("organization")
        .first()
    )
    if existing_user:
        org_title = existing_user.organization.name if existing_user.organization else None
        masked_org = mask_organization_name(org_title) if org_title else "an existing workspace"
        raise ValidationError({
            "detail": f"An account with this email already exists and is connected to '{masked_org}'. Please sign in to your dashboard to change plans or request higher quotas.",
            "code": "ACCOUNT_EXISTS",
            "masked_org": masked_org,
            "login_url": f"/login?email={norm}",
        })

    if org_name and org_name.strip():
        clean_org = org_name.strip()
        if Organization.objects.filter(name__iexact=clean_org).exists():
            raise ValidationError({
                "organization_name": "An organization with this name already exists. Please choose a unique organization name.",
                "detail": "An organization with this name already exists. Please choose a unique organization name.",
                "code": "ORG_EXISTS",
            })


__all__ = [name for name in globals() if not name.startswith('__')]

