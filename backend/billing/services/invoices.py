from .common import *  # noqa: F401,F403
from .access import *  # noqa: F401,F403
from .notifications import *  # noqa: F401,F403
from .subscriptions import *  # noqa: F401,F403
from .subscriptions import _is_custom_invoice

def _quoted_amount(price_bdt, invoice_id, rate):
    rate = Decimal(rate)
    if rate <= 0:
        raise ValidationError({"detail": "USDT conversion rate is not configured."})
    base = (Decimal(price_bdt) / rate).quantize(Decimal("0.001"), rounding=ROUND_UP)
    # A sub-0.10 USDT suffix binds a public transfer to one active invoice.
    suffix = Decimal((invoice_id.int % 99_999) + 1) / Decimal(1_000_000)
    return (base + suffix).quantize(Decimal("0.000001")), rate


def custom_pricing_preview(limits):
    from ..configuration import get_runtime_billing_configuration

    runtime_config = get_runtime_billing_configuration()
    addon_prices = runtime_config.addon_prices
    premium_plus = Plan.objects.get(slug=PREMIUM_PLUS_PLAN_SLUG, is_active=True, is_free=False)
    custom_plan = Plan.objects.get(slug=CUSTOM_PLAN_SLUG, is_active=True, is_free=False)
    minimums = {
        "email_limit": premium_plus.email_limit,
        "max_admins": premium_plus.max_admins,
        "max_users": premium_plus.max_users,
        "max_smtp_accounts": premium_plus.max_smtp_accounts,
        "max_recipients": premium_plus.max_recipients,
    }
    clean_limits = {}
    for key, minimum in minimums.items():
        value = int(limits[key])
        if value < minimum:
            raise ValidationError({key: f"Minimum is {minimum}."})
        if value > CUSTOM_AUTO_LIMITS[key]:
            raise ValidationError({key: "This limit requires an admin quote."})
        clean_limits[key] = value
    premium_was = premium_plus.original_price_bdt or 0
    premium_payable = premium_plus.price_bdt or premium_was
    premium_has_discount = premium_plus.discount_percent > 0 and premium_was > premium_payable
    base_price = premium_was if premium_has_discount else premium_payable
    email_extra = max(0, ((clean_limits["email_limit"] - premium_plus.email_limit + 9999) // 10000)) * addon_prices["email_10k"]
    admin_extra = max(0, clean_limits["max_admins"] - premium_plus.max_admins) * addon_prices["admin"]
    user_extra = max(0, clean_limits["max_users"] - premium_plus.max_users) * addon_prices["user"]
    smtp_extra = max(0, clean_limits["max_smtp_accounts"] - premium_plus.max_smtp_accounts) * addon_prices["smtp_inbox"]
    recipient_extra = max(0, ((clean_limits["max_recipients"] - premium_plus.max_recipients + 9999) // 10000)) * addon_prices["recipient_10k"]
    extra_price = email_extra + admin_extra + user_extra + smtp_extra + recipient_extra
    original_price = base_price + extra_price
    discount_percent = custom_plan.discount_percent
    payable_price = int((Decimal(original_price) * (Decimal(100) - Decimal(discount_percent)) / Decimal(100)).quantize(Decimal("1")))
    snapshot = {
        "custom_plan": True,
        "base_plan_slug": premium_plus.slug,
        "base_price_bdt": base_price,
        "extra_price_bdt": extra_price,
        "original_price_bdt": original_price,
        "discount_percent": discount_percent,
        "discount_amount_bdt": max(0, original_price - payable_price),
        "payable_price_bdt": payable_price,
        "pricing": {
            "email_extra_bdt": email_extra,
            "admin_extra_bdt": admin_extra,
            "user_extra_bdt": user_extra,
            "smtp_inbox_extra_bdt": smtp_extra,
            "recipient_extra_bdt": recipient_extra,
            "addon_prices": addon_prices,
        },
        "email_limit": clean_limits["email_limit"],
        "daily_email_limit": 0,
        "weekly_email_limit": 0,
        "max_admins": clean_limits["max_admins"],
        "max_users": clean_limits["max_users"],
        "max_smtp_accounts": clean_limits["max_smtp_accounts"],
        "max_recipients": clean_limits["max_recipients"],
        "max_campaigns_per_day": custom_plan.max_campaigns_per_day or premium_plus.max_campaigns_per_day,
    }
    return custom_plan, payable_price, snapshot


from .oracle import calculate_native_amount, SYMBOL_BY_NETWORK, DECIMALS_BY_NATIVE_NETWORK


def _populate_invoice_payment(invoice, network, billing_config):
    invoice.receiving_address = {
        "bsc": billing_config.payment_evm_wallet,
        "ethereum": billing_config.payment_evm_wallet,
        "tron": billing_config.payment_tron_wallet,
        "ton": billing_config.payment_ton_wallet,
    }[network]
    
    if getattr(invoice, "payment_asset", PaymentInvoice.PaymentAsset.USDT) == PaymentInvoice.PaymentAsset.NATIVE:
        invoice.token_contract = ""
        invoice.crypto_symbol = SYMBOL_BY_NETWORK[network]
        invoice.token_decimals = DECIMALS_BY_NATIVE_NETWORK[network]
    else:
        invoice.token_contract = {
            "bsc": settings.USDT_BSC_CONTRACT,
            "ethereum": settings.USDT_ETH_CONTRACT,
            "tron": settings.USDT_TRON_CONTRACT,
            "ton": settings.USDT_TON_MASTER,
        }[network]
        invoice.crypto_symbol = "USDT"
        invoice.token_decimals = DECIMALS_BY_NETWORK[network]


def _reserve_unique_invoice_amount(invoice, billing_config):
    if getattr(invoice, "payment_asset", PaymentInvoice.PaymentAsset.USDT) == PaymentInvoice.PaymentAsset.NATIVE:
        crypto_amount, amount_raw, oracle_rate = calculate_native_amount(
            invoice.price_bdt, invoice.network, billing_config.usdt_bdt_rate
        )
        invoice.id = uuid.uuid4()
        invoice.crypto_amount = crypto_amount
        invoice.amount_raw = Decimal(amount_raw)
        invoice.oracle_usd_rate = oracle_rate
        invoice.usdt_bdt_rate = billing_config.usdt_bdt_rate
        invoice.amount_usdt = (Decimal(invoice.price_bdt) / Decimal(billing_config.usdt_bdt_rate)).quantize(Decimal("0.000001"))
        invoice.rate_locked_until = timezone.now() + timedelta(minutes=15)
        return

    for _ in range(20):
        invoice.id = uuid.uuid4()
        invoice.amount_usdt, invoice.usdt_bdt_rate = _quoted_amount(
            invoice.price_bdt, invoice.id, billing_config.usdt_bdt_rate,
        )
        invoice.crypto_amount = invoice.amount_usdt
        invoice.crypto_symbol = "USDT"
        invoice.amount_raw = amount_to_raw(invoice.amount_usdt, invoice.token_decimals)
        if not PaymentInvoice.objects.filter(
            network=invoice.network,
            payment_asset=PaymentInvoice.PaymentAsset.USDT,
            amount_usdt=invoice.amount_usdt,
            status__in=(PaymentInvoice.Status.PENDING, PaymentInvoice.Status.VERIFYING),
            expires_at__gt=timezone.now(),
        ).exists():
            return
    raise ValidationError({"detail": "Could not allocate a unique payment amount. Please try again."})


def _find_conflicting_invoice(validated_data, customer_email, org_key):
    idempotency_key = (validated_data.get("idempotency_key", "") or "").strip()[:96]
    if idempotency_key:
        existing = PaymentInvoice.objects.select_for_update().filter(
            normalized_customer_email=customer_email,
            idempotency_key=idempotency_key,
            status__in=ACTIVE_INVOICE_STATUSES + (PaymentInvoice.Status.EXPIRED,),
        ).order_by("-created_at").first()
        if existing:
            return existing, True
    active = PaymentInvoice.objects.select_for_update().filter(
        models.Q(normalized_customer_email=customer_email) | models.Q(normalized_organization_name=org_key),
        status__in=ACTIVE_INVOICE_STATUSES,
        expires_at__gt=timezone.now(),
    ).order_by("-created_at").first()
    return active, False


@transaction.atomic
def create_invoice(validated_data):
    from ..appsumo import require_direct
    require_direct(validated_data.get("organization"))
    idempotency_key = (validated_data.pop("idempotency_key", "") or "").strip()[:96]
    customer_email = normalized_email(validated_data["customer_email"])
    org_key = normalized_org_name(validated_data["organization_name"])
    conflict, idempotent = _find_conflicting_invoice({"idempotency_key": idempotency_key}, customer_email, org_key)
    if conflict and idempotent:
        return conflict, create_checkout_session(conflict), False
    if conflict:
        from ..tasks import send_recovery_email

        try:
            cast(Any, send_recovery_email).delay(customer_email)
        except Exception:
            pass
        raise InvoiceConflict("A pending invoice already exists for this email. We sent a secure recovery link if it can still be used.")
    plan_slug = validated_data.pop("plan_slug")
    if plan_slug == CUSTOM_PLAN_SLUG:
        raise ValidationError({"plan_slug": "Custom plans must use the custom checkout."})
    plan = Plan.objects.select_for_update().get(slug=plan_slug, is_active=True, is_free=False, channel="direct")
    network = validated_data["network"]
    billing_config = get_runtime_billing_configuration()
    validated_data["customer_email"] = customer_email
    validated_data["normalized_customer_email"] = customer_email
    validated_data["normalized_organization_name"] = org_key
    invoice = PaymentInvoice(plan=plan, price_bdt=plan.price_bdt, expires_at=timezone.now() + timedelta(minutes=settings.PAYMENT_QUOTE_MINUTES), **validated_data)
    invoice.idempotency_key = idempotency_key
    _populate_invoice_payment(invoice, network, billing_config)
    invoice.snapshot_limits = {
        "email_limit": plan.email_limit,
        "daily_email_limit": plan.daily_email_limit,
        "weekly_email_limit": plan.weekly_email_limit,
        "max_admins": plan.max_admins,
        "max_users": plan.max_users,
        "max_smtp_accounts": plan.max_smtp_accounts,
        "max_recipients": plan.max_recipients,
        "max_campaigns_per_day": plan.max_campaigns_per_day,
    }
    _reserve_unique_invoice_amount(invoice, billing_config)
    try:
        invoice.save()
    except IntegrityError as exc:
        raise InvoiceConflict("A pending invoice already exists for this email or checkout request.") from exc
    session_token = create_checkout_session(invoice)
    audit_event("invoice_created", invoice=invoice, metadata={"network": network, "plan": plan.slug})
    transaction.on_commit(lambda: queue_invoice_email(invoice.pk))
    return invoice, session_token, True


@transaction.atomic
def create_custom_invoice(validated_data):
    from ..appsumo import require_direct
    require_direct(validated_data.get("organization"))
    idempotency_key = (validated_data.pop("idempotency_key", "") or "").strip()[:96]
    limits = validated_data.pop("limits")
    customer_email = normalized_email(validated_data["customer_email"])
    org_key = normalized_org_name(validated_data["organization_name"])
    conflict, idempotent = _find_conflicting_invoice({"idempotency_key": idempotency_key}, customer_email, org_key)
    if conflict and idempotent:
        return conflict, create_checkout_session(conflict), False
    if conflict:
        from ..tasks import send_recovery_email

        try:
            cast(Any, send_recovery_email).delay(customer_email)
        except Exception:
            pass
        raise InvoiceConflict("A pending invoice already exists for this email. We sent a secure recovery link if it can still be used.")
    plan, price_bdt, snapshot_limits = custom_pricing_preview(limits)
    network = validated_data["network"]
    billing_config = get_runtime_billing_configuration()
    if price_bdt > billing_config.custom_plan_max_self_serve_price:
        raise ValidationError({
            "detail": f"Custom plan calculation of ৳{price_bdt:,} exceeds the instant self-serve ceiling of ৳{billing_config.custom_plan_max_self_serve_price:,}. Please request an enterprise quote."
        })
    validated_data["customer_email"] = customer_email
    validated_data["normalized_customer_email"] = customer_email
    validated_data["normalized_organization_name"] = org_key
    invoice = PaymentInvoice(
        plan=plan,
        price_bdt=price_bdt,
        expires_at=timezone.now() + timedelta(minutes=settings.PAYMENT_QUOTE_MINUTES),
        **validated_data,
    )
    invoice.idempotency_key = idempotency_key
    _populate_invoice_payment(invoice, network, billing_config)
    invoice.snapshot_limits = snapshot_limits
    _reserve_unique_invoice_amount(invoice, billing_config)
    try:
        invoice.save()
    except IntegrityError as exc:
        raise InvoiceConflict("A pending invoice already exists for this email or checkout request.") from exc
    session_token = create_checkout_session(invoice)
    audit_event("custom_invoice_created", invoice=invoice, metadata={"network": network, "plan": plan.slug, "limits": limits})
    transaction.on_commit(lambda: queue_invoice_email(invoice.pk))
    return invoice, session_token, True


@transaction.atomic
def replace_invoice(invoice, password_hash):
    if invoice.status == PaymentInvoice.Status.PAID:
        raise ValidationError({"detail": "This invoice has already been paid."})
    if invoice.status in {PaymentInvoice.Status.CANCELLED, PaymentInvoice.Status.REPLACED}:
        raise ValidationError({"detail": "This invoice is no longer active."})
    if _is_custom_invoice(invoice):
        data = {
            "network": invoice.network,
            "payment_asset": getattr(invoice, "payment_asset", PaymentInvoice.PaymentAsset.USDT),
            "customer_name": invoice.customer_name,
            "customer_email": invoice.customer_email,
            "organization_name": invoice.organization_name,
            "password_hash": password_hash,
            "idempotency_key": f"replace:{invoice.pk}:{uuid.uuid4()}",
            "limits": {
                "email_limit": invoice.snapshot_limits["email_limit"],
                "max_admins": invoice.snapshot_limits["max_admins"],
                "max_users": invoice.snapshot_limits["max_users"],
                "max_smtp_accounts": invoice.snapshot_limits["max_smtp_accounts"],
                "max_recipients": invoice.snapshot_limits["max_recipients"],
            },
        }
        invoice.status = PaymentInvoice.Status.REPLACED
        invoice.replaced_at = timezone.now()
        invoice.save(update_fields=("status", "replaced_at", "updated_at"))
        revoke_invoice_access(invoice)
        new_invoice, token, _ = create_custom_invoice(data)
        invoice.password_hash = ""
        invoice.replaced_by = new_invoice
        invoice.save(update_fields=("password_hash", "replaced_by", "updated_at"))
        return new_invoice, token

    data = {
        "plan_slug": invoice.plan.slug,
        "network": invoice.network,
        "payment_asset": getattr(invoice, "payment_asset", PaymentInvoice.PaymentAsset.USDT),
        "customer_name": invoice.customer_name,
        "customer_email": invoice.customer_email,
        "organization_name": invoice.organization_name,
        "password_hash": password_hash,
        "idempotency_key": f"replace:{invoice.pk}:{uuid.uuid4()}",
    }
    invoice.status = PaymentInvoice.Status.REPLACED
    invoice.replaced_at = timezone.now()
    invoice.save(update_fields=("status", "replaced_at", "updated_at"))
    revoke_invoice_access(invoice)
    new_invoice, token, _ = create_invoice(data)
    invoice.password_hash = ""
    invoice.replaced_by = new_invoice
    invoice.save(update_fields=("password_hash", "replaced_by", "updated_at"))
    return new_invoice, token


@transaction.atomic
def cancel_invoice(invoice):
    if invoice.status == PaymentInvoice.Status.PAID:
        raise ValidationError({"detail": "Paid invoices cannot be cancelled."})
    if invoice.status in {PaymentInvoice.Status.CANCELLED, PaymentInvoice.Status.REPLACED}:
        return invoice
    invoice.status = PaymentInvoice.Status.CANCELLED
    invoice.password_hash = ""
    invoice.cancelled_at = timezone.now()
    invoice.save(update_fields=("status", "password_hash", "cancelled_at", "updated_at"))
    revoke_invoice_access(invoice)
    audit_event("invoice_cancelled", invoice=invoice)
    return invoice



