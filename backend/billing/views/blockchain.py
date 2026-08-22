from .common import *  # noqa: F401,F403

class BscTransactionInspectView(APIView):
    permission_classes = [OwnerOnly]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "transaction_verify"

    def post(self, request):
        serializer = BscTransactionInspectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = cast(dict[str, Any], serializer.validated_data or {})
        try:
            return Response(inspect_bsc_wallet_transfer(validated_data["transaction"]))
        except VerificationError as exc:
            return Response({
                "found": False,
                "matched_wallet": False,
                "reason": str(exc),
                "transfers": [],
                "matching_transfers": [],
            }, status=400)



