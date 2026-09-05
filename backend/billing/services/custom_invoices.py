from datetime import timedelta
from decimal import Decimal, ROUND_UP
from typing import Any, cast

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from ..configuration import get_runtime_billing_configuration
from ..models import CustomPlanQuote, PaymentInvoice, Plan
from .common import (
    CUSTOM_PLAN_SLUG,
    audit_event,
)
from .invoices import (
    _populate_invoice_payment,
    _reserve_unique_invoice_amount,
)


@transaction.atomic
def create_owner_approved_invoice(
    quote: CustomPlanQuote,
    bdt_price: int,
    network: str,
    owner_user,
    approved_limits: dict[str, Any] | None = None,
    owner_notes: str = "",
) -> PaymentInvoice:
    quote = CustomPlanQuote.objects.select_for_update().get(pk=quote.pk)
    from django.contrib.auth import get_user_model
    from ..appsumo import require_direct
    existing = get_user_model().objects.select_related("organization").filter(email__iexact=quote.customer_email).first()
    if existing and existing.organization_id:
        require_direct(existing.organization)
    if quote.status not in (CustomPlanQuote.Status.PENDING_REVIEW, CustomPlanQuote.Status.INVOICED):
        raise ValidationError({"detail": f"Quote cannot be invoiced from status '{quote.status}'."})

    if quote.invoice_id and quote.invoice.status in (PaymentInvoice.Status.PENDING, PaymentInvoice.Status.VERIFYING, PaymentInvoice.Status.PAYMENT_DETECTED, PaymentInvoice.Status.CONFIRMING):
        if quote.invoice.expires_at > timezone.now():
            raise ValidationError({"detail": "An active pending invoice already exists for this quote."})

    if int(bdt_price) <= 0:
        raise ValidationError({"bdt_price": "Approved BDT price must be greater than zero."})

    if network not in dict(PaymentInvoice.Network.choices):
        raise ValidationError({"network": f"Invalid network. Choose from {', '.join(dict(PaymentInvoice.Network.choices).keys())}."})

    from .custom_quotes import sanitize_custom_limits

    final_limits = sanitize_custom_limits(approved_limits or quote.approved_limits or quote.requested_limits)
    billing_config = get_runtime_billing_configuration()
    fx_rate = Decimal(billing_config.usdt_bdt_rate)
    if fx_rate <= 0:
        raise ValidationError({"detail": "USDT to BDT exchange rate is not configured."})

    base_usdt = (Decimal(bdt_price) / fx_rate).quantize(Decimal("0.001"), rounding=ROUND_UP)
    custom_plan = Plan.objects.filter(slug=CUSTOM_PLAN_SLUG).first()
    if not custom_plan:
        custom_plan = Plan.objects.create(
            slug=CUSTOM_PLAN_SLUG,
            name="Custom",
            price_bdt=bdt_price,
            email_limit=final_limits["email_limit"],
            max_admins=final_limits["max_admins"],
            max_users=final_limits["max_users"],
            max_smtp_accounts=final_limits["max_smtp_accounts"],
            max_recipients=final_limits["max_recipients"],
            max_campaigns_per_day=final_limits["max_campaigns_per_day"],
            is_free=False,
            is_active=True,
        )

    now = timezone.now()
    expires_at = now + timedelta(hours=72)

    invoice = PaymentInvoice(
        plan=custom_plan,
        price_bdt=int(bdt_price),
        usdt_bdt_rate=fx_rate,
        network=network,
        customer_name=quote.customer_name,
        customer_email=quote.customer_email,
        normalized_customer_email=quote.normalized_customer_email,
        organization_name=quote.organization_name,
        normalized_organization_name=quote.normalized_organization_name,
        issued_at=now,
        expires_at=expires_at,
        status=PaymentInvoice.Status.PENDING,
        fx_rate_locked_at=now,
        fx_rate_source="runtime_billing_config",
        base_usdt_amount=base_usdt,
        snapshot_limits={
            "custom_quote": True,
            "quote_id": str(quote.id),
            "quote_number": quote.quote_number,
            "email_limit": final_limits["email_limit"],
            "max_admins": final_limits["max_admins"],
            "max_users": final_limits["max_users"],
            "max_smtp_accounts": final_limits["max_smtp_accounts"],
            "max_recipients": final_limits["max_recipients"],
            "max_campaigns_per_day": final_limits["max_campaigns_per_day"],
        },
    )

    # Cancel any prior active pending invoices for this email or quote
    PaymentInvoice.objects.filter(
        normalized_customer_email=quote.normalized_customer_email,
        status__in=(
            PaymentInvoice.Status.PENDING,
            PaymentInvoice.Status.VERIFYING,
            PaymentInvoice.Status.PAYMENT_DETECTED,
            PaymentInvoice.Status.CONFIRMING,
        ),
    ).update(status=PaymentInvoice.Status.CANCELLED, updated_at=now)

    _populate_invoice_payment(invoice, network, billing_config)
    _reserve_unique_invoice_amount(invoice, billing_config)
    invoice.save()

    quote.invoice = invoice
    quote.quoted_price_bdt = int(bdt_price)
    quote.selected_network = network
    quote.approved_limits = final_limits
    quote.owner_notes = (owner_notes or "").strip()
    quote.reviewed_by = owner_user if getattr(owner_user, "is_authenticated", False) else None
    quote.reviewed_at = now
    quote.status = CustomPlanQuote.Status.INVOICED
    quote.save()

    audit_event(
        "custom_quote_invoiced_72h",
        quote=quote,
        invoice=invoice,
        actor=owner_user,
        metadata={
            "quote_number": quote.quote_number,
            "price_bdt": bdt_price,
            "network": network,
            "amount_usdt": str(invoice.amount_usdt),
            "fx_rate": str(fx_rate),
            "expires_at": expires_at.isoformat(),
        },
    )

    from ..tasks import send_custom_quote_invoice_email

    transaction.on_commit(lambda: cast(Any, send_custom_quote_invoice_email).delay(str(quote.id)))
    return invoice


@transaction.atomic
def reject_custom_quote(quote: CustomPlanQuote, owner_user, reason: str = "") -> CustomPlanQuote:
    quote = CustomPlanQuote.objects.select_for_update().get(pk=quote.pk)
    if quote.status in (CustomPlanQuote.Status.ACTIVATED, CustomPlanQuote.Status.PAID):
        raise ValidationError({"detail": "Cannot reject a quote that has already been paid or activated."})

    quote.status = CustomPlanQuote.Status.REJECTED
    quote.rejection_reason = (reason or "").strip()
    quote.reviewed_by = owner_user if getattr(owner_user, "is_authenticated", False) else None
    quote.reviewed_at = timezone.now()
    quote.save(update_fields=("status", "rejection_reason", "reviewed_by", "reviewed_at", "updated_at"))

    audit_event(
        "custom_quote_rejected",
        quote=quote,
        actor=owner_user,
        metadata={"reason": quote.rejection_reason},
    )

    from ..tasks import send_custom_quote_rejected_email

    if quote.rejection_reason:
        transaction.on_commit(lambda: cast(Any, send_custom_quote_rejected_email).delay(str(quote.id)))

    return quote
