import hashlib
import secrets
from datetime import timedelta
from typing import Any, cast

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from ..models import CustomPlanQuote, PaymentInvoice, PaymentTransferLedger
from .access import revoke_invoice_access
from .common import amount_to_raw, audit_event
from .payment_matching import MatchResult, match_invoice_payment
from .subscriptions import (
    apply_custom_limits_to_organization,
    apply_plan_to_organization,
)


def _ledger_payload(invoice: PaymentInvoice, transfer: Any) -> dict[str, Any]:
    raw = getattr(transfer, "raw", {}) or {}
    return {
        "network": invoice.network,
        "transaction_hash": transfer.transaction_hash,
        "transfer_index": getattr(transfer, "transfer_index", 0),
        "canonical_contract": raw.get("contract") or invoice.token_contract,
        "destination": raw.get("destination") or invoice.receiving_address,
        "amount_raw": getattr(transfer, "amount_raw", None) or amount_to_raw(transfer.amount, invoice.token_decimals),
        "amount_usdt": transfer.amount,
        "block_reference": getattr(transfer, "block_reference", "") or "",
        "confirmations": getattr(transfer, "confirmations", None),
        "occurred_at": getattr(transfer, "occurred_at", timezone.now()),
        "provider_proofs": raw,
        "invoice": invoice,
    }


def record_payment_exception(invoice: PaymentInvoice, transfer: Any, reason: str) -> PaymentTransferLedger:
    payload = _ledger_payload(invoice, transfer)
    ledger, _ = PaymentTransferLedger.objects.get_or_create(
        network=invoice.network,
        transaction_hash=transfer.transaction_hash,
        transfer_index=payload["transfer_index"],
        defaults={
            **payload,
            "resolution": PaymentTransferLedger.Resolution.UNRESOLVED,
            "resolution_history": [{"status": "review_required", "reason": reason, "at": timezone.now().isoformat()}],
        },
    )
    invoice.status = PaymentInvoice.Status.REVIEW_REQUIRED
    invoice.exception_reason = reason
    invoice.transaction_hash = transfer.transaction_hash
    invoice.transfer_index = payload["transfer_index"]
    invoice.verification_data = payload["provider_proofs"]
    invoice.verification_error = f"Payment requires review: {reason}"
    invoice.save(update_fields=("status", "exception_reason", "transaction_hash", "transfer_index", "verification_data", "verification_error", "updated_at"))

    if hasattr(invoice, "custom_quote") and invoice.custom_quote:
        invoice.custom_quote.status = CustomPlanQuote.Status.PAYMENT_REVIEW
        invoice.custom_quote.save(update_fields=("status", "updated_at"))

    audit_event("payment_exception_flagged", invoice=invoice, ledger=ledger, quote=getattr(invoice, "custom_quote", None), metadata={"reason": reason})

    from ..tasks import send_owner_payment_exception_email

    transaction.on_commit(lambda: cast(Any, send_owner_payment_exception_email).delay(str(invoice.pk), reason))
    return ledger


@transaction.atomic
def process_custom_invoice_transfer(invoice_id: str, transfer: Any, *, manual_approval: bool = False, actor=None) -> PaymentInvoice:
    invoice = (
        PaymentInvoice.objects.select_for_update(of=("self",))
        .select_related("plan", "organization")
        .get(pk=invoice_id)
    )

    if invoice.status == PaymentInvoice.Status.PAID:
        return invoice

    quote = CustomPlanQuote.objects.filter(invoice=invoice).first()
    decision = match_invoice_payment(invoice, transfer)

    if not manual_approval and decision.result != MatchResult.EXACT:
        record_payment_exception(invoice, transfer, decision.reason)
        return invoice

    # Confirm and mark PAID
    ledger_payload = _ledger_payload(invoice, transfer)
    target_res = (
        PaymentTransferLedger.Resolution.MANUAL_APPROVED
        if manual_approval
        else PaymentTransferLedger.Resolution.AUTO_ACTIVATED
    )
    ledger, created = PaymentTransferLedger.objects.get_or_create(
        network=invoice.network,
        transaction_hash=transfer.transaction_hash,
        transfer_index=ledger_payload["transfer_index"],
        defaults={
            **ledger_payload,
            "resolution": target_res,
            "resolution_history": [{"status": "paid", "manual": manual_approval, "at": timezone.now().isoformat()}],
        },
    )
    if not created and ledger.resolution != PaymentTransferLedger.Resolution.UNRESOLVED:
        if not manual_approval:
            raise ValidationError({"detail": "This blockchain transfer has already been claimed."})

    ledger.resolution = target_res
    ledger.invoice = invoice
    ledger.save()

    now = timezone.now()
    invoice.status = PaymentInvoice.Status.PAID
    invoice.paid_at = now
    invoice.verified_at = now
    invoice.transaction_hash = transfer.transaction_hash
    invoice.transfer_index = ledger_payload["transfer_index"]
    invoice.verification_data = ledger_payload["provider_proofs"]
    invoice.verification_error = ""
    invoice.save()

    revoke_invoice_access(invoice)

    if quote:
        raw_intent = secrets.token_urlsafe(32)
        quote.activation_intent_digest = hashlib.sha256(raw_intent.encode()).hexdigest()
        quote.activation_intent_created_at = now
        quote.activation_intent_expires_at = now + timedelta(days=7)
        quote.status = CustomPlanQuote.Status.ACTIVATION_PENDING
        quote.save()

        audit_event(
            "custom_quote_payment_confirmed",
            invoice=invoice,
            quote=quote,
            ledger=ledger,
            actor=actor,
            metadata={"manual": manual_approval},
        )

        from ..tasks import send_custom_quote_payment_confirmed_email

        transaction.on_commit(lambda: cast(Any, send_custom_quote_payment_confirmed_email).delay(str(quote.id), raw_intent))
    else:
        # Standard self-serve invoice provisioning path
        from .payments import fulfill_paid_invoice

        fulfill_paid_invoice(invoice.pk, transfer, manual_approval=manual_approval)

    return invoice


@transaction.atomic
def approve_custom_payment_exception(invoice_id: str, owner_user, notes: str = "") -> PaymentInvoice:
    invoice = PaymentInvoice.objects.select_for_update().get(pk=invoice_id)
    if invoice.status != PaymentInvoice.Status.REVIEW_REQUIRED:
        raise ValidationError({"detail": "Only invoices with status 'Review required' can be approved."})

    transfer_data = type("Transfer", (), {
        "transaction_hash": invoice.transaction_hash,
        "transfer_index": invoice.transfer_index,
        "amount": invoice.amount_usdt,
        "amount_raw": invoice.amount_raw,
        "block_reference": "",
        "confirmations": invoice.confirmations_reached,
        "occurred_at": invoice.verified_at or timezone.now(),
        "raw": invoice.verification_data,
    })()

    approved_invoice = process_custom_invoice_transfer(
        invoice_id=str(invoice.pk),
        transfer=transfer_data,
        manual_approval=True,
        actor=owner_user,
    )
    audit_event("owner_approved_payment_exception", invoice=approved_invoice, actor=owner_user, metadata={"notes": notes})
    return approved_invoice


@transaction.atomic
def reject_custom_payment_exception(invoice_id: str, owner_user, reason: str = "") -> PaymentInvoice:
    invoice = PaymentInvoice.objects.select_for_update().get(pk=invoice_id)
    if invoice.status != PaymentInvoice.Status.REVIEW_REQUIRED:
        raise ValidationError({"detail": "Only invoices with status 'Review required' can be rejected."})

    invoice.status = PaymentInvoice.Status.PAYMENT_REJECTED
    invoice.verification_error = reason or "Payment claim rejected by platform owner."
    invoice.save(update_fields=("status", "verification_error", "updated_at"))

    quote = CustomPlanQuote.objects.filter(invoice=invoice).first()
    if quote:
        quote.status = CustomPlanQuote.Status.REJECTED
        quote.rejection_reason = reason or "Payment rejected by platform owner."
        quote.save(update_fields=("status", "rejection_reason", "updated_at"))

    audit_event("owner_rejected_payment_exception", invoice=invoice, quote=quote, actor=owner_user, metadata={"reason": reason})

    from ..tasks import send_custom_quote_payment_rejected_email

    if quote:
        transaction.on_commit(lambda: cast(Any, send_custom_quote_payment_rejected_email).delay(str(quote.id), reason))

    return invoice
