from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.contrib.auth.password_validation import validate_password
from django.conf import settings
from rest_framework import serializers
from django.db import transaction

from decimal import Decimal, ROUND_HALF_UP

from common.models import Organization
from .models import PaymentInvoice, PaymentTransferLedger, Plan

User = get_user_model()


def _usd_equivalent(price_bdt, rate):
    rate = Decimal(str(rate))
    if rate <= 0:
        return None
    return (Decimal(str(price_bdt or 0)) / rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class PricingDisplayMixin:
    def _pricing_config(self):
        if not hasattr(self, "_cached_pricing_config"):
            from .configuration import get_runtime_billing_configuration

            self._cached_pricing_config = get_runtime_billing_configuration()
        return self._cached_pricing_config

    def get_usd_price_display_enabled(self, obj):
        return self._pricing_config().usd_price_display_enabled

    def get_usd_bdt_rate(self, obj):
        return format(self._pricing_config().usdt_bdt_rate, ".4f")

    def _display_usd(self, price_bdt):
        config = self._pricing_config()
        if not config.usd_price_display_enabled:
            return None
        amount = _usd_equivalent(price_bdt, config.usdt_bdt_rate)
        return format(amount, ".2f") if amount is not None else None


def validate_network_enabled(value):
    flag = {
        "bsc": "PAYMENT_NETWORK_BSC_ENABLED",
        "ethereum": "PAYMENT_NETWORK_ETHEREUM_ENABLED",
        "tron": "PAYMENT_NETWORK_TRON_ENABLED",
        "ton": "PAYMENT_NETWORK_TON_ENABLED",
    }[value]
    if not getattr(settings, flag, False):
        raise serializers.ValidationError("This payment network is not enabled yet.")
    return value


class PlanSerializer(PricingDisplayMixin, serializers.ModelSerializer):
    addon_prices = serializers.SerializerMethodField()
    price_usd = serializers.SerializerMethodField()
    original_price_usd = serializers.SerializerMethodField()
    usd_price_display_enabled = serializers.SerializerMethodField()
    usd_bdt_rate = serializers.SerializerMethodField()

    class Meta:
        model = Plan
        fields = (
            "slug", "name", "original_price_bdt", "discount_percent", "price_bdt",
            "email_limit", "daily_email_limit", "weekly_email_limit", "max_admins",
            "max_users", "max_smtp_accounts", "is_free", "max_recipients",
            "max_campaigns_per_day", "is_featured", "badge_text", "button_text",
            "features_list", "support_workspace_enabled", "display_order", "addon_prices",
            "price_usd", "original_price_usd", "usd_price_display_enabled", "usd_bdt_rate",
        )

    def get_addon_prices(self, obj):
        from .configuration import get_runtime_billing_configuration

        return get_runtime_billing_configuration().addon_prices

    def get_price_usd(self, obj):
        return self._display_usd(obj.price_bdt)

    def get_original_price_usd(self, obj):
        return self._display_usd(obj.original_price_bdt)


class PlanAdminSerializer(serializers.ModelSerializer):
    addon_prices = serializers.SerializerMethodField()

    class Meta:
        model = Plan
        fields = (
            "id", "slug", "name", "original_price_bdt", "discount_percent", "price_bdt",
            "email_limit", "daily_email_limit", "weekly_email_limit", "max_admins",
            "max_users", "max_smtp_accounts", "max_recipients", "max_campaigns_per_day",
            "is_free", "is_active", "is_featured", "badge_text", "button_text",
            "features_list", "support_workspace_enabled", "display_order", "addon_prices",
        )
        read_only_fields = ("id", "price_bdt", "addon_prices")

    def get_addon_prices(self, obj):
        from .configuration import get_runtime_billing_configuration

        return get_runtime_billing_configuration().addon_prices

    def validate(self, attrs):
        is_free = attrs.get("is_free", getattr(self.instance, "is_free", False))
        original_price = attrs.get("original_price_bdt", getattr(self.instance, "original_price_bdt", 0))
        discount_percent = attrs.get("discount_percent", getattr(self.instance, "discount_percent", 0))

        if is_free:
            attrs["original_price_bdt"] = 0
            attrs["discount_percent"] = 0
            attrs["price_bdt"] = 0
        else:
            if original_price < 0:
                raise serializers.ValidationError({"original_price_bdt": "Original price cannot be negative."})
            if not (0 <= discount_percent <= 100):
                raise serializers.ValidationError({"discount_percent": "Discount percent must be between 0 and 100."})
            payable = (Decimal(original_price) * (Decimal(100) - Decimal(discount_percent)) / Decimal(100)).quantize(Decimal("1"))
            attrs["price_bdt"] = int(payable)
        return attrs

    @transaction.atomic
    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        from .services import apply_plan_to_organization

        # Custom entitlements come from each paid invoice snapshot. Reapplying
        # the shared template would overwrite individually purchased limits.
        if instance.slug != "custom":
            for subscription in instance.subscriptions.select_related("organization"):
                apply_plan_to_organization(subscription.organization, instance, activate=False)
        return instance


class RegistrationFieldsSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    organization_name = serializers.CharField(max_length=255)
    password = serializers.CharField(write_only=True, min_length=8)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account already exists with this email.")
        return value.strip().lower()

    def validate_organization_name(self, value):
        value = value.strip()
        if Organization.objects.filter(name__iexact=value).exists():
            raise serializers.ValidationError("An organization with this name already exists.")
        return value

    def validate(self, attrs):
        candidate = User(email=attrs.get("email", ""), name=attrs.get("name", ""))
        validate_password(attrs["password"], user=candidate)
        attrs["password_hash"] = make_password(attrs.pop("password"))
        return attrs


class FreeSignupSerializer(RegistrationFieldsSerializer):
    plan_slug = serializers.SlugField(required=False, allow_blank=True)
    turnstile_token = serializers.CharField(required=False, allow_blank=True, write_only=True)


class InvoiceCreateSerializer(RegistrationFieldsSerializer):
    plan_slug = serializers.SlugField()
    network = serializers.ChoiceField(choices=PaymentInvoice.Network.choices)
    payment_asset = serializers.ChoiceField(choices=PaymentInvoice.PaymentAsset.choices, default=PaymentInvoice.PaymentAsset.USDT, required=False)
    idempotency_key = serializers.CharField(max_length=96, required=False, allow_blank=True)

    def validate_plan_slug(self, value):
        if value == "custom" or not Plan.objects.filter(slug=value, is_active=True, is_free=False, channel="direct").exists():
            raise serializers.ValidationError("Choose an active paid plan.")
        return value

    def validate_network(self, value):
        return validate_network_enabled(value)

    def create(self, validated_data):
        from .services import create_invoice

        return create_invoice({
            "plan_slug": validated_data["plan_slug"],
            "network": validated_data["network"],
            "payment_asset": validated_data.get("payment_asset", PaymentInvoice.PaymentAsset.USDT),
            "customer_name": validated_data["name"],
            "customer_email": validated_data["email"],
            "organization_name": validated_data["organization_name"],
            "password_hash": validated_data["password_hash"],
            "idempotency_key": validated_data.get("idempotency_key", ""),
        })


class CustomLimitsSerializer(serializers.Serializer):
    email_limit = serializers.IntegerField(min_value=1)
    max_admins = serializers.IntegerField(min_value=1)
    max_users = serializers.IntegerField(min_value=1)
    max_smtp_accounts = serializers.IntegerField(min_value=1)
    max_recipients = serializers.IntegerField(min_value=1)


class CustomInvoiceCreateSerializer(RegistrationFieldsSerializer):
    network = serializers.ChoiceField(choices=PaymentInvoice.Network.choices)
    payment_asset = serializers.ChoiceField(choices=PaymentInvoice.PaymentAsset.choices, default=PaymentInvoice.PaymentAsset.USDT, required=False)
    idempotency_key = serializers.CharField(max_length=96, required=False, allow_blank=True)
    limits = CustomLimitsSerializer()

    def validate_network(self, value):
        return validate_network_enabled(value)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        from .services import custom_pricing_preview

        try:
            custom_pricing_preview(attrs["limits"])
        except Plan.DoesNotExist as exc:
            raise serializers.ValidationError({"detail": "Custom checkout is not configured yet."}) from exc
        return attrs

    def create(self, validated_data):
        from .services import create_custom_invoice

        return create_custom_invoice({
            "network": validated_data["network"],
            "payment_asset": validated_data.get("payment_asset", PaymentInvoice.PaymentAsset.USDT),
            "customer_name": validated_data["name"],
            "customer_email": validated_data["email"],
            "organization_name": validated_data["organization_name"],
            "password_hash": validated_data["password_hash"],
            "idempotency_key": validated_data.get("idempotency_key", ""),
            "limits": validated_data["limits"],
        })


class AccountInvoiceCreateSerializer(serializers.Serializer):
    plan_slug = serializers.SlugField()
    network = serializers.ChoiceField(choices=PaymentInvoice.Network.choices)
    payment_asset = serializers.ChoiceField(choices=PaymentInvoice.PaymentAsset.choices, default=PaymentInvoice.PaymentAsset.USDT, required=False)
    idempotency_key = serializers.CharField(max_length=96, required=False, allow_blank=True)

    def validate_plan_slug(self, value):
        if value == "custom" or not Plan.objects.filter(slug=value, is_active=True, is_free=False, channel="direct").exists():
            raise serializers.ValidationError("Choose an active paid plan.")
        return value

    def validate_network(self, value):
        return validate_network_enabled(value)

    def create(self, validated_data):
        from .services import create_invoice

        request = self.context["request"]
        user = request.user
        return create_invoice({
            "plan_slug": validated_data["plan_slug"],
            "network": validated_data["network"],
            "payment_asset": validated_data.get("payment_asset", PaymentInvoice.PaymentAsset.USDT),
            "organization": user.organization,
            "customer_name": user.name or user.get_full_name() or user.username,
            "customer_email": user.email,
            "organization_name": user.organization.name,
            "password_hash": "",
            "idempotency_key": validated_data.get("idempotency_key", ""),
        })


class AccountCustomInvoiceCreateSerializer(serializers.Serializer):
    network = serializers.ChoiceField(choices=PaymentInvoice.Network.choices)
    payment_asset = serializers.ChoiceField(choices=PaymentInvoice.PaymentAsset.choices, default=PaymentInvoice.PaymentAsset.USDT, required=False)
    idempotency_key = serializers.CharField(max_length=96, required=False, allow_blank=True)
    limits = CustomLimitsSerializer()

    def validate_network(self, value):
        return validate_network_enabled(value)

    def validate(self, attrs):
        from .services import custom_pricing_preview

        try:
            custom_pricing_preview(attrs["limits"])
        except Plan.DoesNotExist as exc:
            raise serializers.ValidationError({"detail": "Custom checkout is not configured yet."}) from exc
        return attrs

    def create(self, validated_data):
        from .services import create_custom_invoice

        user = self.context["request"].user
        return create_custom_invoice({
            "network": validated_data["network"],
            "payment_asset": validated_data.get("payment_asset", PaymentInvoice.PaymentAsset.USDT),
            "organization": user.organization,
            "customer_name": user.name or user.get_full_name() or user.username,
            "customer_email": user.email,
            "organization_name": user.organization.name,
            "password_hash": "",
            "idempotency_key": validated_data.get("idempotency_key", ""),
            "limits": validated_data["limits"],
        })


class InvoiceSerializer(serializers.ModelSerializer):
    plan = PlanSerializer(read_only=True)
    explorer_url = serializers.SerializerMethodField()
    replaced_by = serializers.UUIDField(source="replaced_by_id", read_only=True)
    price_usd = serializers.SerializerMethodField()
    usd_price_display_enabled = serializers.SerializerMethodField()

    class Meta:
        model = PaymentInvoice
        fields = (
            "id", "plan", "network", "payment_asset", "crypto_symbol", "crypto_amount",
            "oracle_usd_rate", "rate_locked_until", "receiving_address", "token_contract",
            "price_bdt", "usdt_bdt_rate", "amount_usdt", "status", "transaction_hash",
            "price_usd", "usd_price_display_enabled",
            "verification_error", "expires_at", "verified_at", "created_at", "explorer_url",
            "replaced_by", "snapshot_limits", "invoice_email_sent_at", "invoice_email_error",
            "recovery_email_sent_at", "recovery_email_error", "confirmation_email_sent_at",
            "confirmation_email_error", "manual_review_email_sent_at", "manual_review_email_error",
        )
        read_only_fields = fields

    def get_explorer_url(self, obj):
        if not obj.transaction_hash:
            return None
        bases = {
            "bsc": "https://bscscan.com/tx/",
            "ethereum": "https://etherscan.io/tx/",
            "tron": "https://tronscan.org/#/transaction/",
            "ton": "https://tonviewer.com/transaction/",
        }
        return f"{bases[obj.network]}{obj.transaction_hash}"

    def get_usd_price_display_enabled(self, obj):
        from .configuration import get_runtime_billing_configuration

        return get_runtime_billing_configuration().usd_price_display_enabled

    def get_price_usd(self, obj):
        if not self.get_usd_price_display_enabled(obj):
            return None
        amount = _usd_equivalent(obj.price_bdt, obj.usdt_bdt_rate)
        return format(amount, ".2f") if amount is not None else None


class TransactionSubmissionSerializer(serializers.Serializer):
    transaction = serializers.CharField(max_length=500)


class BlockchainTransactionInspectSerializer(serializers.Serializer):
    network = serializers.ChoiceField(choices=["bsc", "ethereum", "tron", "ton"], default="bsc", required=False)
    transaction = serializers.CharField(max_length=500)


BscTransactionInspectSerializer = BlockchainTransactionInspectSerializer


class CheckoutEmailStartSerializer(serializers.Serializer):
    email = serializers.EmailField()
    turnstile_token = serializers.CharField(required=False, allow_blank=True, max_length=4096)

    def validate_email(self, value):
        return value.strip().lower()


class CheckoutEmailVerifySerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(min_length=6, max_length=6)

    def validate_email(self, value):
        return value.strip().lower()


class InvoiceRecoverSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.strip().lower()


class InvoiceReplaceSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        invoice = self.context["invoice"]
        candidate = User(email=invoice.customer_email, name=invoice.customer_name)
        validate_password(attrs["password"], user=candidate)
        attrs["password_hash"] = make_password(attrs.pop("password"))
        return attrs


class PaymentTransferLedgerSerializer(serializers.ModelSerializer):
    invoice_id = serializers.UUIDField(source="invoice.id", read_only=True)
    customer_email = serializers.EmailField(source="invoice.customer_email", read_only=True)
    plan_name = serializers.CharField(source="invoice.plan.name", read_only=True)

    class Meta:
        model = PaymentTransferLedger
        fields = (
            "id", "network", "transaction_hash", "transfer_index", "canonical_contract",
            "destination", "amount_raw", "amount_usdt", "block_reference", "confirmations",
            "invoice_id", "customer_email", "plan_name", "resolution", "refund_transaction_hash",
            "notes", "created_at", "updated_at",
        )
        read_only_fields = fields


class ManualReviewActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=("approve", "reject", "refund"))
    notes = serializers.CharField(required=False, allow_blank=True, max_length=4000)
    refund_transaction_hash = serializers.CharField(required=False, allow_blank=True, max_length=128)


# --- Custom Plan Quotes & Post-Payment Activation Serializers ---


class CustomQuoteOtpRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()
    turnstile_token = serializers.CharField(required=False, allow_blank=True, max_length=4096)

    def validate_email(self, value):
        return value.strip().lower()


class CustomQuoteOtpVerifySerializer(serializers.Serializer):
    verification_id = serializers.UUIDField()
    otp = serializers.CharField(min_length=6, max_length=6)


class CustomQuoteSubmitSerializer(serializers.Serializer):
    verification_id = serializers.UUIDField()
    customer_name = serializers.CharField(max_length=150)
    organization_name = serializers.CharField(max_length=255)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=4000)
    requested_limits = serializers.DictField()


class AccountCustomQuoteSubmitSerializer(serializers.Serializer):
    notes = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    requested_limits = serializers.DictField()


from .models import CustomPlanQuote, EmailVerification


class CustomPlanQuoteSerializer(serializers.ModelSerializer):
    invoice = InvoiceSerializer(read_only=True)
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CustomPlanQuote
        fields = (
            "id", "quote_number", "status", "customer_name", "customer_email",
            "organization_name", "notes", "requested_limits", "approved_limits",
            "quoted_price_bdt", "selected_network", "owner_notes", "rejection_reason",
            "reviewed_by_name", "reviewed_at", "invoice", "activated_at", "created_at",
        )
        read_only_fields = fields

    def get_reviewed_by_name(self, obj):
        if not obj.reviewed_by:
            return None
        return obj.reviewed_by.name or obj.reviewed_by.email


class CustomQuoteApproveInvoiceSerializer(serializers.Serializer):
    price_bdt = serializers.IntegerField(min_value=1)
    network = serializers.ChoiceField(choices=PaymentInvoice.Network.choices)
    approved_limits = serializers.DictField(required=False)
    owner_notes = serializers.CharField(required=False, allow_blank=True, max_length=4000)


class CustomQuoteRejectSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, max_length=4000)


class CustomActivationStartSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=128)


class CustomActivationVerifyOtpSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=128)
    otp = serializers.CharField(min_length=6, max_length=6)


class CustomActivationCompleteSerializer(serializers.Serializer):
    session_token = serializers.CharField(max_length=128)
    quote_id = serializers.UUIDField()
    username = serializers.CharField(required=False, allow_blank=True, max_length=150)
    name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})

        username = (attrs.get("username") or "").strip()
        if username:
            if len(username) < 3:
                raise serializers.ValidationError({"username": "Username must be at least 3 characters long."})
            import re
            if not re.match(r"^[a-zA-Z0-9_.-]+$", username):
                raise serializers.ValidationError({"username": "Username may only contain letters, numbers, underscores, dots, and hyphens."})
            attrs["username"] = username

        if "name" in attrs:
            attrs["name"] = (attrs.get("name") or "").strip()

        return attrs
