import hashlib
from base64 import urlsafe_b64encode
from dataclasses import dataclass
from decimal import Decimal

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings

from common.models import BillingConfiguration


def _fernet():
    key = getattr(settings, "FIELD_ENCRYPTION_KEY", None)
    if not key:
        key = urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode()).digest()).decode()
    return Fernet(key.encode())


def encrypt_billing_secret(value):
    return _fernet().encrypt(value.encode()).decode() if value else ""


def decrypt_billing_secret(value):
    if not value:
        return ""
    try:
        return _fernet().decrypt(value.encode()).decode()
    except (InvalidToken, ValueError, TypeError):
        return ""


def get_billing_configuration():
    defaults = {
        "usdt_bdt_rate": Decimal(str(getattr(settings, "USDT_BDT_RATE", "122.0000"))),
        "payment_evm_wallet": getattr(settings, "PAYMENT_EVM_WALLET", ""),
        "payment_tron_wallet": getattr(settings, "PAYMENT_TRON_WALLET", ""),
        "payment_ton_wallet": getattr(settings, "PAYMENT_TON_WALLET", ""),
        "encrypted_tron_api_key": encrypt_billing_secret(getattr(settings, "TRON_API_KEY", "")),
        "encrypted_toncenter_api_key": encrypt_billing_secret(getattr(settings, "TONCENTER_API_KEY", "")),
    }
    try:
        return BillingConfiguration.objects.get_or_create(pk=1, defaults=defaults)[0]
    except Exception:
        return BillingConfiguration(pk=1, **defaults)


@dataclass(frozen=True)
class RuntimeBillingConfiguration:
    usdt_bdt_rate: Decimal
    payment_evm_wallet: str
    payment_tron_wallet: str
    payment_ton_wallet: str
    tron_api_key: str
    toncenter_api_key: str
    addon_email_10k_price: int
    addon_admin_price: int
    addon_user_price: int
    addon_smtp_price: int
    addon_recipient_10k_price: int
    custom_plan_max_self_serve_price: int

    @property
    def addon_prices(self) -> dict[str, int]:
        return {
            "email_10k": self.addon_email_10k_price,
            "admin": self.addon_admin_price,
            "user": self.addon_user_price,
            "smtp_inbox": self.addon_smtp_price,
            "recipient_10k": self.addon_recipient_10k_price,
            "max_self_serve_price": self.custom_plan_max_self_serve_price,
        }


def get_runtime_billing_configuration():
    config = get_billing_configuration()
    return RuntimeBillingConfiguration(
        usdt_bdt_rate=config.usdt_bdt_rate,
        payment_evm_wallet=config.payment_evm_wallet,
        payment_tron_wallet=config.payment_tron_wallet,
        payment_ton_wallet=config.payment_ton_wallet,
        tron_api_key=decrypt_billing_secret(config.encrypted_tron_api_key),
        toncenter_api_key=decrypt_billing_secret(config.encrypted_toncenter_api_key),
        addon_email_10k_price=getattr(config, "addon_email_10k_price", 120),
        addon_admin_price=getattr(config, "addon_admin_price", 150),
        addon_user_price=getattr(config, "addon_user_price", 20),
        addon_smtp_price=getattr(config, "addon_smtp_price", 300),
        addon_recipient_10k_price=getattr(config, "addon_recipient_10k_price", 100),
        custom_plan_max_self_serve_price=getattr(config, "custom_plan_max_self_serve_price_bdt", 15000),
    )
