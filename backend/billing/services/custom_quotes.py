import hashlib
import secrets
from datetime import timedelta
from typing import Any, cast

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from ..models import CustomPlanQuote, EmailVerification, Plan
from .common import (
    PREMIUM_PLUS_PLAN_SLUG,
    audit_event,
    normalized_email,
    normalized_org_name,
)
from .turnstile import verify_turnstile


@transaction.atomic
def generate_quote_number() -> str:
    """Generate a concurrency-safe sequential quote number like CQ-2026-000001."""
    year = timezone.now().year
    prefix = f"CQ-{year}-"
    last_quote = (
        CustomPlanQuote.objects.select_for_update()
        .filter(quote_number__startswith=prefix)
        .order_by("-quote_number")
        .first()
    )
    if last_quote:
        try:
            seq = int(last_quote.quote_number.split("-")[-1]) + 1
        except (ValueError, IndexError):
            seq = 1
    else:
        seq = 1
    return f"{prefix}{seq:06d}"


def sanitize_custom_limits(limits: dict[str, Any]) -> dict[str, int]:
    premium_plus = Plan.objects.filter(slug=PREMIUM_PLUS_PLAN_SLUG).first()
    base_emails = getattr(premium_plus, "email_limit", 150000)
    base_admins = getattr(premium_plus, "max_admins", 5)
    base_users = getattr(premium_plus, "max_users", 50)
    base_connections = getattr(premium_plus, "max_smtp_accounts", 10)
    base_recipients = getattr(premium_plus, "max_recipients", 10000)

    try:
        clean = {
            "email_limit": max(int(limits.get("email_limit", base_emails)), base_emails),
            "max_admins": max(int(limits.get("max_admins", base_admins)), base_admins),
            "max_users": max(int(limits.get("max_users", base_users)), base_users),
            "max_smtp_accounts": max(int(limits.get("max_smtp_accounts", base_connections)), base_connections),
            "max_recipients": max(int(limits.get("max_recipients", base_recipients)), base_recipients),
            "max_campaigns_per_day": max(int(limits.get("max_campaigns_per_day", 10)), 10),
        }
    except (TypeError, ValueError) as exc:
        raise ValidationError({"limits": "Invalid numeric limits provided."}) from exc
    return clean


def request_quote_otp(email: str, turnstile_token: str, request=None) -> tuple[EmailVerification, str]:
    if not email or "@" not in email:
        raise ValidationError({"email": "Enter a valid email address."})
    verify_turnstile(turnstile_token, request)

    norm_email = normalized_email(email)
    raw_otp = f"{secrets.randbelow(1_000_000):06d}"
    code_digest = hashlib.sha256(raw_otp.encode()).hexdigest()

    # Invalidate previous unconsumed quote submission OTPs for this email
    EmailVerification.objects.filter(
        normalized_email=norm_email,
        purpose=EmailVerification.Purpose.CUSTOM_QUOTE_SUBMISSION,
        consumed_at__isnull=True,
    ).update(consumed_at=timezone.now())

    verification = EmailVerification.objects.create(
        email=email.strip().lower(),
        normalized_email=norm_email,
        purpose=EmailVerification.Purpose.CUSTOM_QUOTE_SUBMISSION,
        code_digest=code_digest,
        expires_at=timezone.now() + timedelta(minutes=10),
    )

    from ..tasks import send_checkout_otp_email

    transaction.on_commit(lambda: cast(Any, send_checkout_otp_email).delay(verification.email, raw_otp))
    return verification, raw_otp


def verify_quote_otp(verification_id: str, otp_code: str) -> EmailVerification:
    otp_code = (otp_code or "").strip()
    if len(otp_code) != 6 or not otp_code.isdigit():
        raise ValidationError({"otp": "Enter a valid 6-digit code."})

    try:
        verification = EmailVerification.objects.get(
            pk=verification_id,
            purpose=EmailVerification.Purpose.CUSTOM_QUOTE_SUBMISSION,
            consumed_at__isnull=True,
        )
    except (EmailVerification.DoesNotExist, ValueError):
        raise ValidationError({"detail": "This verification code request has expired. Please request a new code."})

    if verification.expires_at <= timezone.now():
        raise ValidationError({"detail": "This verification code has expired. Please request a new code."})

    if verification.attempts >= verification.max_attempts:
        raise ValidationError({"detail": "Maximum attempts exceeded. Please request a new code."})

    verification.attempts += 1
    input_digest = hashlib.sha256(otp_code.encode()).hexdigest()
    if input_digest != verification.code_digest:
        verification.save(update_fields=("attempts",))
        raise ValidationError({"otp": "The verification code is incorrect."})

    verification.verified_at = timezone.now()
    verification.save(update_fields=("attempts", "verified_at"))
    return verification


@transaction.atomic
def submit_custom_quote(
    *,
    verification_id: str,
    customer_name: str,
    organization_name: str,
    requested_limits: dict[str, Any],
    notes: str = "",
    request=None,
) -> CustomPlanQuote:
    try:
        verification = EmailVerification.objects.select_for_update().get(
            pk=verification_id,
            purpose=EmailVerification.Purpose.CUSTOM_QUOTE_SUBMISSION,
            verified_at__isnull=False,
            consumed_at__isnull=True,
        )
    except (EmailVerification.DoesNotExist, ValueError):
        raise ValidationError({"verification_id": "You must verify your email before submitting a custom quote."})

    if verification.expires_at <= timezone.now():
        raise ValidationError({"verification_id": "The verification session has expired. Please verify your email again."})

    customer_name = (customer_name or "").strip()
    organization_name = (organization_name or "").strip()
    if not customer_name:
        raise ValidationError({"customer_name": "Full name is required."})
    if not organization_name:
        raise ValidationError({"organization_name": "Organization name is required."})

    clean_limits = sanitize_custom_limits(requested_limits)
    quote_number = generate_quote_number()
    norm_email = verification.normalized_email
    norm_org = normalized_org_name(organization_name)

    quote = CustomPlanQuote.objects.create(
        quote_number=quote_number,
        customer_name=customer_name,
        customer_email=verification.email,
        normalized_customer_email=norm_email,
        organization_name=organization_name,
        normalized_organization_name=norm_org,
        notes=(notes or "").strip(),
        initial_email_verified_at=verification.verified_at,
        requested_limits=clean_limits,
        approved_limits=clean_limits,
        status=CustomPlanQuote.Status.PENDING_REVIEW,
    )

    verification.consumed_at = timezone.now()
    verification.save(update_fields=("consumed_at",))

    audit_event(
        "custom_quote_submitted",
        quote=quote,
        request=request,
        metadata={"quote_number": quote_number, "limits": clean_limits},
    )

    from ..tasks import send_custom_quote_received_email, send_owner_quote_alert_email

    transaction.on_commit(lambda: cast(Any, send_custom_quote_received_email).delay(str(quote.id)))
    transaction.on_commit(lambda: cast(Any, send_owner_quote_alert_email).delay(str(quote.id)))
    return quote
