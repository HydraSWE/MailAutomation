from .common import *  # noqa: F401,F403
from .access import *  # noqa: F401,F403
from .notifications import *  # noqa: F401,F403
from .subscriptions import *  # noqa: F401,F403
from .subscriptions import _create_customer, _is_custom_invoice

def _ledger_payload(invoice, transfer):
    raw = transfer.raw or {}
    return {
        "network": invoice.network,
        "transaction_hash": transfer.transaction_hash,
        "transfer_index": transfer.transfer_index,
        "canonical_contract": raw.get("contract") or invoice.token_contract,
        "destination": raw.get("destination") or invoice.receiving_address,
        "amount_raw": getattr(transfer, "amount_raw", None) or amount_to_raw(transfer.amount, invoice.token_decimals),
        "amount_usdt": transfer.amount,
        "block_reference": transfer.block_reference or "",
        "confirmations": transfer.confirmations,
        "occurred_at": transfer.occurred_at,
        "provider_proofs": raw,
        "invoice": invoice,
    }


def record_review_claim(invoice, transfer, reason):
    try:
        ledger, _ = PaymentTransferLedger.objects.get_or_create(
            network=invoice.network,
            transaction_hash=transfer.transaction_hash,
            transfer_index=transfer.transfer_index,
            defaults={**_ledger_payload(invoice, transfer), "resolution_history": [{"status": "review", "reason": reason, "at": timezone.now().isoformat()}]},
        )
    except IntegrityError:
        ledger = PaymentTransferLedger.objects.get(
            network=invoice.network,
            transaction_hash=transfer.transaction_hash,
            transfer_index=transfer.transfer_index,
        )
    audit_event("payment_review_claim", invoice=invoice, ledger=ledger, metadata={"reason": reason})
    return ledger


@transaction.atomic
def resolve_manual_transfer(ledger_id, action, *, actor, notes="", refund_transaction_hash=""):
    ledger = PaymentTransferLedger.objects.select_for_update(of=("self",)).select_related("invoice", "invoice__plan", "invoice__organization").get(pk=ledger_id)
    invoice = ledger.invoice
    if not invoice:
        raise ValidationError({"detail": "This transfer is not bound to an invoice."})
    if ledger.resolution != PaymentTransferLedger.Resolution.UNRESOLVED:
        raise ValidationError({"detail": "This transfer has already been resolved."})
    if action == "approve":
        if invoice.status != PaymentInvoice.Status.MANUAL_REVIEW:
            raise ValidationError({"detail": "Only manual-review invoices can be approved."})
        invoice = fulfill_paid_invoice(invoice.pk, type("Transfer", (), {
            "transaction_hash": ledger.transaction_hash,
            "transfer_index": ledger.transfer_index,
            "amount": ledger.amount_usdt,
            "amount_raw": ledger.amount_raw,
            "block_reference": ledger.block_reference,
            "confirmations": ledger.confirmations,
            "occurred_at": ledger.occurred_at,
            "raw": ledger.provider_proofs,
        })(), manual_approval=True)
        ledger.refresh_from_db()
    elif action == "reject":
        ledger.resolution = PaymentTransferLedger.Resolution.MANUAL_REJECTED
        invoice.status = PaymentInvoice.Status.REJECTED
        invoice.verification_error = notes or "Payment claim rejected after owner review."
        invoice.password_hash = ""
        invoice.save(update_fields=("status", "verification_error", "password_hash", "updated_at"))
    elif action == "refund":
        if not refund_transaction_hash:
            raise ValidationError({"refund_transaction_hash": "Record the outbound refund transaction hash."})
        ledger.resolution = PaymentTransferLedger.Resolution.MANUAL_REFUNDED
        ledger.refund_transaction_hash = refund_transaction_hash
        invoice.status = PaymentInvoice.Status.REJECTED
        invoice.verification_error = notes or "Payment was marked refunded by owner review."
        invoice.password_hash = ""
        invoice.save(update_fields=("status", "verification_error", "password_hash", "updated_at"))
    else:
        raise ValidationError({"action": "Choose approve, reject, or refund."})
    ledger.notes = notes
    ledger.resolution_history = [
        *ledger.resolution_history,
        {"status": ledger.resolution, "actor": getattr(actor, "email", ""), "notes": notes, "at": timezone.now().isoformat()},
    ]
    ledger.save(update_fields=("resolution", "refund_transaction_hash", "notes", "resolution_history", "updated_at"))
    audit_event(f"manual_transfer_{action}", invoice=invoice, ledger=ledger, actor=actor, metadata={"notes": notes})
    return ledger


@transaction.atomic
def fulfill_paid_invoice(invoice_id, transfer, *, manual_approval=False):
    invoice = PaymentInvoice.objects.select_for_update(of=("self",)).select_related("plan", "organization").get(pk=invoice_id)
    if invoice.status == PaymentInvoice.Status.PAID:
        return invoice
    allowed_statuses = {PaymentInvoice.Status.PENDING, PaymentInvoice.Status.VERIFYING}
    if manual_approval:
        allowed_statuses.add(PaymentInvoice.Status.MANUAL_REVIEW)
    if invoice.status not in allowed_statuses:
        raise ValidationError({"detail": "This invoice can no longer be fulfilled."})
    if not manual_approval and amount_to_raw(transfer.amount, invoice.token_decimals) != invoice.amount_raw:
        record_review_claim(invoice, transfer, "amount_mismatch")
        invoice.status = PaymentInvoice.Status.MANUAL_REVIEW
        invoice.transaction_hash = transfer.transaction_hash
        invoice.transfer_index = transfer.transfer_index
        invoice.verification_data = transfer.raw
        invoice.verification_error = "Payment amount does not exactly match this invoice."
        invoice.password_hash = ""
        invoice.save(update_fields=("status", "transaction_hash", "transfer_index", "verification_data", "verification_error", "password_hash", "updated_at"))
        return invoice
    try:
        target_resolution = (
            PaymentTransferLedger.Resolution.MANUAL_APPROVED
            if manual_approval
            else PaymentTransferLedger.Resolution.AUTO_ACTIVATED
        )
        history_status = "manual_approved" if manual_approval else "auto_activated"
        ledger, created = PaymentTransferLedger.objects.get_or_create(
            network=invoice.network,
            transaction_hash=transfer.transaction_hash,
            transfer_index=transfer.transfer_index,
            defaults={
                **_ledger_payload(invoice, transfer),
                "resolution": target_resolution,
                "resolution_history": [{"status": history_status, "invoice": str(invoice.pk), "at": timezone.now().isoformat()}],
            },
        )
        if not created and ledger.resolution != PaymentTransferLedger.Resolution.UNRESOLVED:
            raise IntegrityError("transfer already resolved")
        if not created:
            ledger.invoice = invoice
            ledger.resolution = target_resolution
            ledger.resolution_history = [
                *ledger.resolution_history,
                {"status": history_status, "invoice": str(invoice.pk), "at": timezone.now().isoformat()},
            ]
            ledger.save(update_fields=("invoice", "resolution", "resolution_history", "updated_at"))
    except IntegrityError as exc:
        raise ValidationError({"detail": "This blockchain transfer has already been used."})
    invoice_obj = cast(Any, invoice)
    if invoice_obj.organization_id:
        organization = invoice_obj.organization
        if _is_custom_invoice(invoice_obj):
            apply_custom_limits_to_organization(organization, invoice_obj.snapshot_limits)
        else:
            apply_plan_to_organization(organization, invoice_obj.plan)
        now = timezone.now()
        subscription, created = Subscription.objects.get_or_create(
            organization=organization,
            defaults={
                "plan": invoice_obj.plan, "status": Subscription.Status.ACTIVE,
                "current_period_start": now, "current_period_end": now + timedelta(days=30),
            },
        )
        subscription_obj = cast(Any, subscription)
        same_active_plan = not created and (
            subscription_obj.plan_id == invoice_obj.plan_id
            and subscription_obj.status == Subscription.Status.ACTIVE
            and subscription_obj.current_period_end > now
        )
        if not created:
            if same_active_plan:
                subscription_obj.current_period_end += timedelta(days=30)
            else:
                subscription_obj.plan = invoice_obj.plan
                subscription_obj.current_period_start = now
                subscription_obj.current_period_end = now + timedelta(days=30)
            subscription_obj.status = Subscription.Status.ACTIVE
            subscription_obj.save()
    else:
        organization, _ = _create_customer(invoice, invoice_obj.plan)
        invoice_obj.organization = organization
    invoice.transaction_hash = transfer.transaction_hash
    invoice.transfer_index = transfer.transfer_index
    invoice.verification_data = transfer.raw
    invoice.verification_error = ""
    invoice.password_hash = ""
    invoice.status = PaymentInvoice.Status.PAID
    invoice.verified_at = timezone.now()
    invoice.save()
    revoke_invoice_access(invoice)
    audit_event(
        "invoice_manual_activated" if manual_approval else "invoice_auto_activated",
        invoice=invoice,
        ledger=ledger,
    )
    from ..tasks import send_payment_confirmation_email

    transaction.on_commit(lambda: cast(Any, send_payment_confirmation_email).delay(str(invoice.pk)))
    return invoice
### This iss nothing

