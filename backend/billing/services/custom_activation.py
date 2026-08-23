import hashlib
import secrets
from datetime import timedelta
from typing import Any, cast

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.tokens import RefreshToken

from common.models import Organization
from ..models import (
    CustomPlanQuote,
    CustomPlanSetupSession,
    EmailVerification,
    PaymentInvoice,
    Subscription,
)
from .common import audit_event
from .subscriptions import (
    _unique_username,
    apply_custom_limits_to_organization,
)

User = get_user_model()


def _mask_email(email: str) -> str:
    if "@" not in email:
        return email
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        masked_local = f"{local[0]}*"
    else:
        masked_local = f"{local[0]}{'*' * (len(local) - 2)}{local[-1]}"
    return f"{masked_local}@{domain}"


def validate_activation_intent(raw_token: str) -> CustomPlanQuote:
    raw_token = (raw_token or "").strip()
    if not raw_token:
        raise ValidationError({"detail": "Activation token is required."})

    digest = hashlib.sha256(raw_token.encode()).hexdigest()
    quote = CustomPlanQuote.objects.filter(
        activation_intent_digest=digest,
        status=CustomPlanQuote.Status.ACTIVATION_PENDING,
        activation_intent_expires_at__gt=timezone.now(),
        activation_intent_used_at__isnull=True,
    ).select_related("invoice").first()

    if not quote or not quote.invoice or quote.invoice.status != PaymentInvoice.Status.PAID:
        raise ValidationError({"detail": "This activation link is invalid, expired, or has already been used."})

    return quote


def request_activation_otp(raw_token: str, request=None) -> tuple[EmailVerification, str]:
    quote = validate_activation_intent(raw_token)
    norm_email = quote.normalized_customer_email

    # Invalidate previous unconsumed activation OTPs
    EmailVerification.objects.filter(
        normalized_email=norm_email,
        purpose=EmailVerification.Purpose.CUSTOM_PLAN_ACTIVATION,
        consumed_at__isnull=True,
    ).update(consumed_at=timezone.now())

    raw_otp = f"{secrets.randbelow(1_000_000):06d}"
    code_digest = hashlib.sha256(raw_otp.encode()).hexdigest()

    verification = EmailVerification.objects.create(
        email=quote.customer_email,
        normalized_email=norm_email,
        purpose=EmailVerification.Purpose.CUSTOM_PLAN_ACTIVATION,
        code_digest=code_digest,
        expires_at=timezone.now() + timedelta(minutes=10),
    )

    from ..tasks import send_custom_activation_otp_email

    transaction.on_commit(lambda: cast(Any, send_custom_activation_otp_email).delay(verification.email, raw_otp, quote.organization_name))
    return verification, raw_otp


def verify_activation_otp(raw_token: str, otp_code: str) -> tuple[CustomPlanSetupSession, str]:
    quote = validate_activation_intent(raw_token)
    otp_code = (otp_code or "").strip()

    if len(otp_code) != 6 or not otp_code.isdigit():
        raise ValidationError({"otp": "Enter a valid 6-digit verification code."})

    verification = EmailVerification.objects.filter(
        normalized_email=quote.normalized_customer_email,
        purpose=EmailVerification.Purpose.CUSTOM_PLAN_ACTIVATION,
        consumed_at__isnull=True,
        verified_at__isnull=True,
    ).order_by("-created_at").first()

    if not verification or verification.expires_at <= timezone.now():
        raise ValidationError({"detail": "The verification code has expired. Request a new code."})

    if verification.attempts >= verification.max_attempts:
        raise ValidationError({"detail": "Too many failed attempts. Request a new code."})

    verification.attempts += 1
    input_digest = hashlib.sha256(otp_code.encode()).hexdigest()
    if input_digest != verification.code_digest:
        verification.save(update_fields=("attempts",))
        raise ValidationError({"otp": "Incorrect verification code."})

    verification.verified_at = timezone.now()
    verification.save(update_fields=("attempts", "verified_at"))

    raw_session_token = secrets.token_urlsafe(32)
    session_digest = hashlib.sha256(raw_session_token.encode()).hexdigest()
    session = CustomPlanSetupSession.objects.create(
        quote=quote,
        email_verification=verification,
        token_digest=session_digest,
        expires_at=timezone.now() + timedelta(minutes=30),
    )

    return session, raw_session_token


def validate_setup_session(session_token: str) -> CustomPlanSetupSession:
    if not session_token:
        raise ValidationError({"detail": "Setup session token is missing."})

    digest = hashlib.sha256(session_token.encode()).hexdigest()
    session = CustomPlanSetupSession.objects.select_related("quote", "email_verification").filter(
        token_digest=digest,
        consumed_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).first()

    if not session:
        raise ValidationError({"detail": "Setup session has expired. Please verify your email again."})

    return session


def get_pending_paid_quotes_for_session(session_token: str) -> list[dict[str, Any]]:
    session = validate_setup_session(session_token)
    norm_email = session.email_verification.normalized_email

    pending_quotes = CustomPlanQuote.objects.filter(
        normalized_customer_email=norm_email,
        status=CustomPlanQuote.Status.ACTIVATION_PENDING,
        invoice__status=PaymentInvoice.Status.PAID,
    ).select_related("invoice").order_by("-created_at")

    results = []
    for item in pending_quotes:
        results.append({
            "quote_id": str(item.id),
            "quote_number": item.quote_number,
            "organization_name": item.organization_name,
            "customer_name": item.customer_name,
            "customer_email": item.customer_email,
            "approved_limits": item.approved_limits or item.requested_limits,
            "paid_at": item.invoice.paid_at.isoformat() if item.invoice.paid_at else None,
        })
    return results


@transaction.atomic
def complete_custom_activation(
    *,
    session_token: str,
    quote_id: str,
    password: str,
    username: str | None = None,
    name: str | None = None,
    request=None,
) -> tuple[Organization, Any, dict[str, Any]]:
    session = validate_setup_session(session_token)
    norm_email = session.email_verification.normalized_email

    try:
        quote = CustomPlanQuote.objects.select_for_update(of=("self",)).select_related("invoice", "invoice__plan").get(
            pk=quote_id,
            normalized_customer_email=norm_email,
        )
    except (CustomPlanQuote.DoesNotExist, ValueError):
        raise ValidationError({"quote_id": "Selected custom quote was not found for this verified account."})

    if quote.status == CustomPlanQuote.Status.ACTIVATED:
        raise ValidationError({"detail": "This workspace organization has already been activated."})

    if quote.status != CustomPlanQuote.Status.ACTIVATION_PENDING or not quote.invoice or quote.invoice.status != PaymentInvoice.Status.PAID:
        raise ValidationError({"detail": "This quote is not eligible for workspace activation."})

    password = (password or "").strip()
    if len(password) < 8:
        raise ValidationError({"password": "Password must be at least 8 characters long."})

    username = (username or "").strip()
    name = (name or "").strip() or quote.customer_name

    candidate_user = User(email=quote.customer_email, name=name, username=username or "admin")
    validate_password(password, user=candidate_user)

    # 1. Create Organization
    organization = Organization.objects.create(name=quote.organization_name)
    snapshot_limits = quote.invoice.snapshot_limits or quote.approved_limits
    apply_custom_limits_to_organization(organization, snapshot_limits, activate=True)

    # 2. Create or Update Admin User
    user = User.objects.filter(email__iexact=quote.customer_email).first()
    if user:
        if username and username.lower() != user.username.lower():
            if User.objects.filter(username__iexact=username).exclude(pk=user.pk).exists():
                raise ValidationError({"username": "This username is already taken. Please choose another."})
            user.username = username
        user.name = name or user.name
        user.first_name = name or user.first_name
        user.role = User.Role.ADMIN
        user.organization = organization
        user.set_password(password)
        user.save()
    else:
        if username:
            if User.objects.filter(username__iexact=username).exists():
                raise ValidationError({"username": "This username is already taken. Please choose another."})
            final_username = username
        else:
            final_username = _unique_username(quote.customer_email)

        user = User.objects.create_user(
            username=final_username,
            email=quote.customer_email,
            name=name,
            first_name=name,
            password=password,
            role=User.Role.ADMIN,
            organization=organization,
        )
    organization.created_by = user
    organization.save(update_fields=("created_by", "updated_at"))

    # 3. Create Subscription
    now = timezone.now()
    Subscription.objects.create(
        organization=organization,
        plan=quote.invoice.plan,
        status=Subscription.Status.ACTIVE,
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
    )

    # 4. Mark Quote Activated
    quote.activated_organization = organization
    quote.activated_user = user
    quote.activated_at = now
    quote.activation_intent_used_at = now
    quote.status = CustomPlanQuote.Status.ACTIVATED
    quote.save()

    # 5. Consume setup session & verification
    session.consumed_at = now
    session.save(update_fields=("consumed_at",))
    session.email_verification.consumed_at = now
    session.email_verification.save(update_fields=("consumed_at",))

    audit_event(
        "custom_workspace_activated",
        quote=quote,
        invoice=quote.invoice,
        actor=user,
        request=request,
        metadata={"organization": organization.name, "user": user.email, "username": user.username},
    )

    from ..tasks import send_custom_workspace_ready_email

    transaction.on_commit(lambda: cast(Any, send_custom_workspace_ready_email).delay(str(quote.id)))

    # Generate JWT Tokens for automatic login
    refresh = RefreshToken.for_user(user)
    auth_data = {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "organization": {
                "id": organization.id,
                "name": organization.name,
            },
        },
    }

    return organization, user, auth_data

