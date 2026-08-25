from .common import *  # noqa: F401,F403
from .notifications import queue_account_created_email
from .turnstile import verify_turnstile

def apply_plan_to_organization(organization, plan, *, activate=True):
    plan_key = (plan.slug or "").strip().lower()
    plan_name = (plan.name or "").strip().lower()
    support_workspace_plan = (
        getattr(plan, "support_workspace_enabled", False)
        or plan_key in {"premium-plus", "custom"}
        or plan_name in {"premium+", "premium plus", "custom"}
    )
    organization.max_admins = plan.max_admins
    organization.max_users = plan.max_users
    organization.max_smtp_accounts = plan.max_smtp_accounts
    organization.daily_email_limit = plan.daily_email_limit
    organization.weekly_email_limit = plan.weekly_email_limit
    organization.monthly_email_limit = plan.email_limit
    organization.max_recipients = plan.max_recipients
    organization.max_campaigns_per_day = plan.max_campaigns_per_day
    organization.support_workspace_enabled = support_workspace_plan
    update_fields = [
        "max_admins", "max_users", "max_smtp_accounts", "daily_email_limit",
        "weekly_email_limit", "monthly_email_limit", "max_recipients",
        "max_campaigns_per_day", "support_workspace_enabled", "updated_at",
    ]
    if not support_workspace_plan:
        update_fields.append("support_workspace_enabled")
    if activate:
        organization.status = Organization.Status.ACTIVE
        update_fields.append("status")
    organization.save(update_fields=update_fields)


def apply_custom_limits_to_organization(organization, snapshot_limits, *, activate=True):
    organization.max_admins = int(snapshot_limits["max_admins"])
    organization.max_users = int(snapshot_limits["max_users"])
    organization.max_smtp_accounts = int(snapshot_limits["max_smtp_accounts"])
    organization.daily_email_limit = int(snapshot_limits.get("daily_email_limit", 0))
    organization.weekly_email_limit = int(snapshot_limits.get("weekly_email_limit", 0))
    organization.monthly_email_limit = int(snapshot_limits["email_limit"])
    organization.max_recipients = int(snapshot_limits["max_recipients"])
    organization.max_campaigns_per_day = int(snapshot_limits.get("max_campaigns_per_day", 10))
    organization.support_workspace_enabled = True
    update_fields = [
        "max_admins", "max_users", "max_smtp_accounts", "daily_email_limit",
        "weekly_email_limit", "monthly_email_limit", "max_recipients",
        "max_campaigns_per_day", "support_workspace_enabled", "updated_at",
    ]
    if activate:
        organization.status = Organization.Status.ACTIVE
        update_fields.append("status")
    organization.save(update_fields=update_fields)


@transaction.atomic
def assign_plan_to_organization(organization, plan, *, activate_organization=False):
    apply_plan_to_organization(organization, plan, activate=activate_organization)
    now = timezone.now()
    subscription, created = Subscription.objects.get_or_create(
        organization=organization,
        defaults={
            "plan": plan,
            "status": Subscription.Status.ACTIVE,
            "current_period_start": now,
            "current_period_end": now + timedelta(days=30),
        },
    )
    if not created:
        subscription_obj = cast(Any, subscription)
        needs_new_period = (
            subscription_obj.plan_id != plan.id
            or subscription_obj.status != Subscription.Status.ACTIVE
            or subscription_obj.current_period_end <= now
        )
        subscription_obj.plan = plan
        subscription_obj.status = Subscription.Status.ACTIVE
        if needs_new_period:
            subscription_obj.current_period_start = now
            subscription_obj.current_period_end = now + timedelta(days=30)
        subscription_obj.save()
    return subscription


def _unique_username(email):
    base = email.split("@", 1)[0][:120] or "admin"
    value, counter = base, 1
    while User.objects.filter(username=value).exists():
        suffix = str(counter)
        value = f"{base[:150-len(suffix)]}{suffix}"
        counter += 1
    return value


def _is_custom_invoice(invoice):
    return bool(getattr(invoice.plan, "slug", "") == CUSTOM_PLAN_SLUG and invoice.snapshot_limits.get("custom_plan"))


def _create_customer(invoice_or_data, plan):
    email = invoice_or_data.customer_email if hasattr(invoice_or_data, "customer_email") else invoice_or_data["email"]
    name = invoice_or_data.customer_name if hasattr(invoice_or_data, "customer_name") else invoice_or_data["name"]
    org_name = invoice_or_data.organization_name if hasattr(invoice_or_data, "organization_name") else invoice_or_data["organization_name"]
    password_hash = invoice_or_data.password_hash if hasattr(invoice_or_data, "password_hash") else invoice_or_data["password_hash"]
    if User.objects.filter(email__iexact=email).exists():
        raise ValidationError({"email": "An account already exists with this email."})
    organization = Organization.objects.create(name=org_name)
    if hasattr(invoice_or_data, "snapshot_limits") and invoice_or_data.snapshot_limits.get("custom_plan"):
        apply_custom_limits_to_organization(organization, invoice_or_data.snapshot_limits)
    else:
        apply_plan_to_organization(organization, plan)
    user = User(
        username=_unique_username(email), email=email, name=name, first_name=name,
        role=cast(Any, User).Role.ADMIN, organization=organization, password=password_hash,
    )
    user.save()
    organization.created_by = user
    organization.save(update_fields=("created_by", "updated_at"))
    now = timezone.now()
    Subscription.objects.create(
        organization=organization, plan=plan, status=Subscription.Status.ACTIVE,
        current_period_start=now, current_period_end=now + timedelta(days=30),
    )
    transaction.on_commit(lambda: queue_account_created_email(user.pk))
    return organization, user


@transaction.atomic
def provision_free_account(data, request):
    verify_turnstile(data.get("turnstile_token", ""), request)
    check_account_available_for_signup(data["email"], data.get("organization_name"))
    ip_digest = private_hash(client_ip(request))
    email_digest = private_hash(data["email"])
    if FreePlanClaim.objects.filter(ip_hash=ip_digest).exists():
        raise ValidationError({"detail": "A free account has already been created from this IP address."})
    if FreePlanClaim.objects.filter(email_hash=email_digest).exists():
        raise ValidationError({"detail": "This email has already claimed a free account."})
    
    plan = None
    plan_slug = (data.get("plan_slug") or "").strip()
    if plan_slug:
        plan = Plan.objects.select_for_update().filter(slug=plan_slug, is_free=True, is_active=True).first()
    if not plan:
        plan = Plan.objects.select_for_update().filter(is_free=True, is_active=True).order_by("display_order").first()
    if not plan:
        raise ValidationError({"detail": "No active free plan is currently available."})

    organization, user = _create_customer(data, plan)
    try:
        FreePlanClaim.objects.create(ip_hash=ip_digest, email_hash=email_digest, organization=organization)
    except IntegrityError as exc:
        raise ValidationError({"detail": "This free-plan claim has already been used."}) from exc
    return organization, user



