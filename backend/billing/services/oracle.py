import logging
from typing import Any
from decimal import Decimal
import requests
from django.core.cache import cache
from rest_framework.exceptions import ValidationError

logger = logging.getLogger(__name__)

CACHE_KEY_ORACLE_RATES = "billing_oracle_rates_v1"
CACHE_TTL_SECONDS = 60

SYMBOL_BY_NETWORK = {
    "bsc": "BNB",
    "tron": "TRX",
    "ton": "GRAM",
    "ethereum": "ETH",
}

DECIMALS_BY_NATIVE_NETWORK = {
    "bsc": 18,
    "tron": 6,
    "ton": 9,
    "ethereum": 18,
}

BINANCE_TICKER_MAP = {
    "bsc": "BNBUSDT",
    "tron": "TRXUSDT",
    "ton": "TONUSDT",
    "ethereum": "ETHUSDT",
}

COINGECKO_ID_MAP = {
    "bsc": "binancecoin",
    "tron": "tron",
    "ton": "the-open-network",
    "ethereum": "ethereum",
}


class OracleUnavailableError(ValidationError):
    """Raised when live oracle price feeds are unreachable."""
    status_code = 503
    default_code = "oracle_unavailable"


import json


def fetch_binance_prices() -> dict[str, Decimal]:
    """Fetch live ticker prices from Binance public market data API."""
    symbols = list(BINANCE_TICKER_MAP.values())
    symbols_param = json.dumps(symbols, separators=(',', ':'))
    url = f"https://api.binance.com/api/v3/ticker/price?symbols={symbols_param}"
    
    try:
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        items = response.json()
        price_by_symbol = {item["symbol"]: Decimal(str(item["price"])) for item in items if "symbol" in item}
        
        rates = {}
        for net, sym in BINANCE_TICKER_MAP.items():
            if sym in price_by_symbol and price_by_symbol[sym] > 0:
                rates[net] = price_by_symbol[sym]
        return rates
    except Exception as exc:
        logger.warning("Binance price oracle fetch failed: %s", exc)
        return {}


def fetch_coingecko_prices() -> dict[str, Decimal]:
    """Fallback live price fetcher using CoinGecko public simple price API."""
    ids = ",".join(COINGECKO_ID_MAP.values())
    url = f"https://api.coingecko.com/api/v3/simple/price?ids={ids}&vs_currencies=usd"
    
    try:
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        rates = {}
        for net, gecko_id in COINGECKO_ID_MAP.items():
            if gecko_id in data and "usd" in data[gecko_id] and data[gecko_id]["usd"] > 0:
                rates[net] = Decimal(str(data[gecko_id]["usd"]))
        return rates
    except Exception as exc:
        logger.warning("CoinGecko price oracle fetch failed: %s", exc)
        return {}


import time

_LOCAL_MEM_CACHE: dict[str, Any] = {"rates": {}, "expires_at": 0.0}


def get_live_rates() -> dict[str, Decimal]:
    """
    Get live USD prices for all supported native crypto assets.
    Results are cached for 60 seconds.
    Strictly zero fallback prices: only returns confirmed live rates from exchanges.
    """
    now = time.time()
    if _LOCAL_MEM_CACHE["rates"] and _LOCAL_MEM_CACHE["expires_at"] > now:
        return _LOCAL_MEM_CACHE["rates"]

    try:
        cached = cache.get(CACHE_KEY_ORACLE_RATES)
        if cached:
            _LOCAL_MEM_CACHE["rates"] = cached
            _LOCAL_MEM_CACHE["expires_at"] = now + CACHE_TTL_SECONDS
            return cached
    except Exception as exc:
        logger.debug("Cache read failed in oracle: %s", exc)

    # 1. Fetch from Binance
    prices = fetch_binance_prices()
    
    # 2. If incomplete, supplement missing coins from CoinGecko
    missing_nets = [net for net in BINANCE_TICKER_MAP if net not in prices]
    if missing_nets:
        gecko_prices = fetch_coingecko_prices()
        for net in missing_nets:
            if net in gecko_prices:
                prices[net] = gecko_prices[net]

    if prices:
        _LOCAL_MEM_CACHE["rates"] = prices
        _LOCAL_MEM_CACHE["expires_at"] = now + CACHE_TTL_SECONDS
        try:
            cache.set(CACHE_KEY_ORACLE_RATES, prices, CACHE_TTL_SECONDS)
        except Exception as exc:
            logger.debug("Cache write failed in oracle: %s", exc)
    return prices


def get_asset_usd_rate(network: str, asset: str = "native") -> Decimal:
    """
    Return the USD rate for the given network and asset.
    If asset is native and no live price is available, locks the payment system with an error.
    """
    if asset == "usdt":
        return Decimal("1.00")
    
    net = (network or "bsc").lower().strip()
    if net == "eth":
        net = "ethereum"
        
    rates = get_live_rates()
    rate = rates.get(net)
    
    if not rate or rate <= 0:
        symbol = SYMBOL_BY_NETWORK.get(net, net.upper())
        raise OracleUnavailableError({
            "network": (
                f"Live pricing for {symbol} is temporarily unavailable from upstream price oracles. "
                f"Native payment for {symbol} is locked for safety. Please select USDT or try again shortly."
            )
        })
        
    return rate


def calculate_native_amount(
    price_bdt: int | Decimal,
    network: str,
    usdt_bdt_rate: Decimal
) -> tuple[Decimal, int, Decimal]:
    """
    Calculate required native token units given price in BDT.
    
    Raises:
        OracleUnavailableError: If live oracle pricing is unavailable for this asset.
        
    Returns:
        (crypto_amount, amount_raw, oracle_usd_rate)
    """
    usd_rate = get_asset_usd_rate(network, asset="native")
    usd_total = Decimal(price_bdt) / Decimal(usdt_bdt_rate)
    
    net = network.lower().strip()
    if net in {"bsc", "ethereum"}:
        # 18 decimals (Wei)
        crypto_amount = (usd_total / usd_rate).quantize(Decimal("0.000000000000000001"))
        amount_raw = int(crypto_amount * Decimal(10**18))
    elif net == "tron":
        # 6 decimals (SUN)
        crypto_amount = (usd_total / usd_rate).quantize(Decimal("0.000001"))
        amount_raw = int(crypto_amount * Decimal(10**6))
    elif net == "ton":
        # 9 decimals (NanoTON)
        crypto_amount = (usd_total / usd_rate).quantize(Decimal("0.000000001"))
        amount_raw = int(crypto_amount * Decimal(10**9))
    else:
        crypto_amount = (usd_total / usd_rate).quantize(Decimal("0.000000000000000001"))
        amount_raw = int(crypto_amount * Decimal(10**18))
        
    return crypto_amount, amount_raw, usd_rate
