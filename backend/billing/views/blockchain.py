from .common import *  # noqa: F401,F403
from rest_framework.permissions import AllowAny
from django.utils import timezone
from ..services.oracle import get_live_rates, SYMBOL_BY_NETWORK, DECIMALS_BY_NATIVE_NETWORK
from ..configuration import get_runtime_billing_configuration


class OracleRatesView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        config = get_runtime_billing_configuration()
        rates = get_live_rates()
        
        rates_payload = {}
        for net, sym in SYMBOL_BY_NETWORK.items():
            usd_price = rates.get(net)
            rates_payload[net] = {
                "symbol": sym,
                "usd_price": str(usd_price) if usd_price is not None else None,
                "decimals": DECIMALS_BY_NATIVE_NETWORK.get(net, 18),
                "is_available": usd_price is not None and usd_price > 0,
            }
            
        return Response({
            "usdt_bdt_rate": str(config.usdt_bdt_rate),
            "rates": rates_payload,
            "timestamp": timezone.now().isoformat(),
        })


class BlockchainTransactionInspectView(APIView):
    permission_classes = [OwnerOnly]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "transaction_verify"

    def post(self, request):
        serializer = BlockchainTransactionInspectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = cast(dict[str, Any], serializer.validated_data or {})
        network = validated_data.get("network", "bsc")
        try:
            return Response(inspect_wallet_transfer(network, validated_data["transaction"]))
        except VerificationError as exc:
            return Response({
                "found": False,
                "matched_wallet": False,
                "network": network,
                "reason": str(exc),
                "transfers": [],
                "matching_transfers": [],
            }, status=400)


BscTransactionInspectView = BlockchainTransactionInspectView



