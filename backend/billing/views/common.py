from typing import Any, cast

from django.conf import settings
from django.db import transaction
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework import viewsets
from common.permissions import OwnerOnly

from ..blockchain import VerificationError, inspect_bsc_wallet_transfer, verify_invoice_transfer
from ..models import PaymentInvoice, PaymentTransferLedger, Plan
from ..serializers import (
    AccountCustomInvoiceCreateSerializer, AccountInvoiceCreateSerializer, CheckoutEmailStartSerializer, CheckoutEmailVerifySerializer,
    CustomInvoiceCreateSerializer, FreeSignupSerializer, InvoiceCreateSerializer, InvoiceRecoverSerializer, InvoiceReplaceSerializer,
    InvoiceSerializer, ManualReviewActionSerializer, PaymentTransferLedgerSerializer, PlanAdminSerializer,
    PlanSerializer, BscTransactionInspectSerializer, TransactionSubmissionSerializer,
)
from ..services import (
    authorize_checkout_session, cancel_invoice, consume_precheckout_session, exchange_invoice_code,
    checkout_cookie_name, fulfill_paid_invoice, replace_invoice, resolve_manual_transfer,
    provision_free_account, record_review_claim, serialize_invoice_access, start_checkout_email_verification,
    verify_checkout_email,
)


def _cookie_name(name):
    return checkout_cookie_name(name)


def _checkout_cookie_samesite():
    return getattr(settings, "CHECKOUT_SESSION_COOKIE_SAMESITE", "Lax")


class CsrfProtectedAPIView(APIView):
    @method_decorator(csrf_protect)
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)


class CsrfBootstrapView(APIView):
    permission_classes = [AllowAny]

    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        return Response({"csrfToken": get_token(request)})


__all__ = [name for name in globals() if not name.startswith('__')]

