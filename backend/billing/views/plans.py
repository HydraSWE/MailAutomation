from .common import *  # noqa: F401,F403

class PlanListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        plans = Plan.objects.filter(is_active=True, channel="direct")
        return Response(PlanSerializer(plans, many=True).data)


class PlanAdminViewSet(viewsets.ModelViewSet):
    serializer_class = PlanAdminSerializer
    permission_classes = [OwnerOnly]
    queryset = Plan.objects.filter(channel="direct").order_by("display_order", "price_bdt")
    http_method_names = ["get", "post", "put", "patch", "head", "options"]


class PaymentReviewViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PaymentTransferLedgerSerializer
    permission_classes = [OwnerOnly]
    queryset = PaymentTransferLedger.objects.select_related("invoice", "invoice__plan").all()

    def get_queryset(self):
        queryset = super().get_queryset()
        resolution = self.request.query_params.get("resolution")
        if resolution:
            queryset = queryset.filter(resolution=resolution)
        return queryset

    def action(self, request, pk=None):
        ledger = self.get_object()
        serializer = ManualReviewActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ledger = resolve_manual_transfer(
            ledger.pk,
            serializer.validated_data["action"],
            actor=request.user,
            notes=serializer.validated_data.get("notes", ""),
            refund_transaction_hash=serializer.validated_data.get("refund_transaction_hash", ""),
        )
        return Response(PaymentTransferLedgerSerializer(ledger).data)



