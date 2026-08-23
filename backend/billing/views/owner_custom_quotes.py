from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import CustomPlanQuote
from ..serializers import (
    CustomPlanQuoteSerializer,
    CustomQuoteApproveInvoiceSerializer,
    CustomQuoteRejectSerializer,
    InvoiceSerializer,
)
from ..services.custom_invoices import (
    create_owner_approved_invoice,
    reject_custom_quote,
)
from ..services.payment_fulfillment import (
    approve_custom_payment_exception,
    reject_custom_payment_exception,
)
from .common import OwnerOnly


class OwnerCustomQuoteViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [OwnerOnly]
    serializer_class = CustomPlanQuoteSerializer
    queryset = (
        CustomPlanQuote.objects
        .select_related("invoice", "invoice__plan", "reviewed_by", "activated_organization")
        .all()
        .order_by("-created_at")
    )

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)

        search = (self.request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(quote_number__icontains=search)
                | Q(customer_name__icontains=search)
                | Q(customer_email__icontains=search)
                | Q(organization_name__icontains=search)
            )
        return qs

    @action(detail=True, methods=["post"], url_path="approve-and-invoice")
    def approve_and_invoice(self, request, pk=None):
        quote = self.get_object()
        serializer = CustomQuoteApproveInvoiceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        invoice = create_owner_approved_invoice(
            quote=quote,
            bdt_price=serializer.validated_data["price_bdt"],
            network=serializer.validated_data["network"],
            owner_user=request.user,
            approved_limits=serializer.validated_data.get("approved_limits"),
            owner_notes=serializer.validated_data.get("owner_notes", ""),
        )

        quote.refresh_from_db()
        return Response({
            "quote": CustomPlanQuoteSerializer(quote).data,
            "invoice": InvoiceSerializer(invoice).data,
            "detail": "72-hour custom invoice issued and sent to customer.",
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        quote = self.get_object()
        serializer = CustomQuoteRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        quote = reject_custom_quote(
            quote=quote,
            owner_user=request.user,
            reason=serializer.validated_data.get("reason", ""),
        )
        return Response(CustomPlanQuoteSerializer(quote).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="payment-review/approve")
    def payment_review_approve(self, request, pk=None):
        quote = self.get_object()
        if not quote.invoice_id:
            return Response({"detail": "This quote has no associated invoice."}, status=status.HTTP_400_BAD_REQUEST)

        notes = request.data.get("notes", "")
        approved_invoice = approve_custom_payment_exception(
            invoice_id=str(quote.invoice_id),
            owner_user=request.user,
            notes=notes,
        )
        quote.refresh_from_db()
        return Response({
            "quote": CustomPlanQuoteSerializer(quote).data,
            "invoice": InvoiceSerializer(approved_invoice).data,
            "detail": "Payment exception approved. Activation link sent to customer.",
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="payment-review/reject")
    def payment_review_reject(self, request, pk=None):
        quote = self.get_object()
        if not quote.invoice_id:
            return Response({"detail": "This quote has no associated invoice."}, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get("reason", "")
        rejected_invoice = reject_custom_payment_exception(
            invoice_id=str(quote.invoice_id),
            owner_user=request.user,
            reason=reason,
        )
        quote.refresh_from_db()
        return Response({
            "quote": CustomPlanQuoteSerializer(quote).data,
            "invoice": InvoiceSerializer(rejected_invoice).data,
            "detail": "Payment exception rejected.",
        }, status=status.HTTP_200_OK)
