from dataclasses import dataclass
from decimal import Decimal
from enum import Enum
from typing import Any, cast

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from ..models import CustomPlanQuote, PaymentInvoice, PaymentTransferLedger
from .common import amount_to_raw, audit_event


class MatchResult(str, Enum):
    EXACT = "exact"
    UNDERPAID = "underpaid"
    OVERPAID = "overpaid"
    LATE = "late"
    AMBIGUOUS = "ambiguous"
    NOT_RELEVANT = "not_relevant"


@dataclass(frozen=True)
class PaymentDecision:
    result: MatchResult
    reason: str
    expected_amount: Decimal
    received_amount: Decimal
    is_on_time: bool


def match_invoice_payment(invoice: PaymentInvoice, transfer: Any) -> PaymentDecision:
    received_raw = getattr(transfer, "amount_raw", None) or amount_to_raw(transfer.amount, invoice.token_decimals)
    received_amount = Decimal(str(transfer.amount))
    expected_amount = Decimal(str(invoice.amount_usdt))

    # Evaluate on-time against blockchain block time
    transfer_time = getattr(transfer, "occurred_at", None) or timezone.now()
    is_on_time = transfer_time <= invoice.expires_at

    if not is_on_time:
        return PaymentDecision(
            result=MatchResult.LATE,
            reason="PAID_LATE",
            expected_amount=expected_amount,
            received_amount=received_amount,
            is_on_time=False,
        )

    if received_raw < invoice.amount_raw:
        return PaymentDecision(
            result=MatchResult.UNDERPAID,
            reason="UNDERPAID",
            expected_amount=expected_amount,
            received_amount=received_amount,
            is_on_time=True,
        )

    if received_raw > invoice.amount_raw:
        return PaymentDecision(
            result=MatchResult.OVERPAID,
            reason="OVERPAID",
            expected_amount=expected_amount,
            received_amount=received_amount,
            is_on_time=True,
        )

    return PaymentDecision(
        result=MatchResult.EXACT,
        reason="",
        expected_amount=expected_amount,
        received_amount=received_amount,
        is_on_time=True,
    )
