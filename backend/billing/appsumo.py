"""AppSumo entitlements and transactional redemption, independent of checkout."""
import hashlib
import hmac
import secrets
from datetime import timedelta
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from common.models import Organization
from .models import (Plan, Subscription, AppSumoOffer, AppSumoTier, AppSumoEntitlement,
    AppSumoBatch, AppSumoCode, AppSumoAudit, AppSumoUsage, AppSumoSendReservation)
from .services.access import _fernet

CODE_PREFIX = "AS"
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def fail(code, detail):
    raise ValidationError({"code": code, "detail": detail})


def digest(value):
    key = getattr(settings, "APPSUMO_CODE_KEY", "")
    if not key:
        fail("not_configured", "AppSumo code storage is not configured.")
    return hmac.new(key.encode(), value.encode(), hashlib.sha256).hexdigest()


def normalize(code):
    value = "".join(ch for ch in str(code).upper() if not ch.isspace() and ch != "-")
    if not value.isascii() or not value.isalnum() or not 20 <= len(value) <= 200:
        fail("invalid_code", "This AppSumo code is invalid.")
    return value


def generate_code():
    body = "".join(secrets.choice(CODE_ALPHABET) for _ in range(32))
    groups = [CODE_PREFIX, *[body[i:i + 4] for i in range(0, len(body), 4)]]
    return "-".join(groups)


def mask_code(raw):
    normalized = normalize(raw)
    prefix = normalized[:2] if normalized.startswith(CODE_PREFIX) else ""
    tail = normalized[-4:]
    return f"{prefix}-****-{tail}" if prefix else "****" + normalized[-6:]


def audit(action, actor=None, reference="", **metadata):
    return AppSumoAudit.objects.create(action=action, actor=actor, reference=str(reference), metadata=metadata)


def entitlement_for(org):
    if not org:
        return None
    return AppSumoEntitlement.objects.select_related("offer").filter(organization_id=org.pk).first()


def bounds(entitlement, now=None):
    now = now or timezone.now()
    index = max(0, (now - entitlement.activated_at) // timedelta(days=30))
    start = entitlement.activated_at + index * timedelta(days=30)
    return start, start + timedelta(days=30)


def tier_for(ent):
    return AppSumoTier.objects.select_related("plan").get(offer=ent.offer, tier=max(ent.tier, 1))


def capacity_issues(org, limits):
    from common.plan_features import organization_mailbox_usage
    checks = [
        ("contacts", org.recipients.count(), limits["contacts"]),
        ("mailboxes", organization_mailbox_usage(org)["used"], limits["mailboxes"]),
        ("seats", org.users.filter(is_active=True).count(), limits["seats"]),
    ]
    return [{"resource": name, "used": used, "limit": limit} for name, used, limit in checks if used > limit]


def resolve(org):
    ent = entitlement_for(org)
    if not ent:
        sub = Subscription.objects.filter(organization=org).select_related("plan").first()
        return {"access_type": "recurring", "active": bool(org.status == "active" and sub and sub.status == "active" and sub.current_period_end > timezone.now()), "can_checkout": True}
    limits = tier_for(ent).limits
    start, end = bounds(ent)
    sub = Subscription.objects.filter(organization=org).first()
    return {"access_type": "lifetime", "active": ent.status == "active" and org.status == "active" and bool(sub and sub.status == "active"),
        "status": ent.status, "tier": ent.tier, "limits": limits, "period_start": start, "period_end": end,
        "can_checkout": False, "capacity_issues": capacity_issues(org, limits), "terms": ent.terms_snapshot}


def require_productive(org):
    if not entitlement_for(org):
        return
    state = resolve(org)
    if not state["active"]:
        fail("inactive_entitlement", "Lifetime access is suspended or revoked. Contact support.")
    if state["capacity_issues"]:
        fail("over_capacity", "Reduce contacts, mailboxes, or active seats to your tier allowance before continuing.")


def require_direct(org=None, plan=None):
    if (plan and plan.channel != "direct") or (org and entitlement_for(org)):
        fail("appsumo_checkout", "AppSumo lifetime access is managed through code redemption, not subscription checkout.")


def usage_for(org, now=None):
    ent = entitlement_for(org)
    start, end = bounds(ent, now)
    usage, _ = AppSumoUsage.objects.get_or_create(organization=org, start=start, defaults={"end": end})
    return usage


def summary(org):
    state = resolve(org)
    if state["access_type"] != "lifetime":
        from common.plan_features import organization_mailbox_usage
        state["conversion_usage"] = {"contacts": org.recipients.count(),
            "mailboxes": organization_mailbox_usage(org)["used"],
            "seats": org.users.filter(is_active=True).count()}
        return state
    usage = usage_for(org)
    reserved = usage.reservations.filter(state__in=["reserved", "ambiguous"]).count()
    state["usage"] = {"emails_sent": usage.emails_sent, "emails_reserved": reserved, "imports": usage.imports,
        "emails_remaining": max(0, state["limits"]["emails"] - usage.emails_sent - reserved),
        "imports_remaining": max(0, state["limits"]["imports"] - usage.imports)}
    state["codes"] = list(AppSumoCode.objects.filter(organization=org).values("id", "masked_code", "redeemed_at", "revoked"))
    return state


@transaction.atomic
def generate_batch(offer, environment, actor, count=1000):
    if not getattr(settings, "APPSUMO_CODE_ADMIN_ENABLED", False):
        fail("disabled", "Code generation and export are disabled.")
    count = int(count)
    if environment not in ("test", "production") or not offer.published or not 1 <= count <= 10000:
        fail("invalid_batch", "Choose a published offer, test or production environment, and 1 to 10,000 codes.")
    batch = AppSumoBatch.objects.create(offer=offer, environment=environment)
    rows = []
    for _ in range(count):
        raw = generate_code()
        normalized = normalize(raw)
        rows.append(AppSumoCode(batch=batch, digest=digest(normalized), encrypted_code=_fernet().encrypt(raw.encode()).decode(), masked_code=mask_code(raw)))
    AppSumoCode.objects.bulk_create(rows)
    audit("batch_generated", actor, batch.pk, count=count, environment=environment)
    return batch


def export_batch(batch, actor):
    if not getattr(settings, "APPSUMO_CODE_ADMIN_ENABLED", False):
        fail("disabled", "Code generation and export are disabled.")
    audit("batch_exported", actor, batch.pk)
    return "\r\n".join(_fernet().decrypt(c.encrypted_code.encode()).decode() for c in batch.codes.order_by("id")) + "\r\n"


def apply_entitlement(ent, *, first=False):
    org = ent.organization
    if ent.tier == 0:
        ent.status = "revoked"
        ent.save(update_fields=["status", "tier"])
        Subscription.objects.filter(organization=org).update(status="expired")
        return
    tier = tier_for(ent)
    limits = tier.limits
    for field, value in {"monthly_email_limit": limits["emails"], "max_recipients": limits["contacts"],
        "max_smtp_accounts": limits["mailboxes"], "max_admins": limits["seats"], "max_users": limits["seats"],
        "daily_email_limit": 0, "weekly_email_limit": 0, "max_campaigns_per_day": 10}.items():
        setattr(org, field, value)
    if first:
        org.status = "active"
        org.support_workspace_enabled = True
    org.save()
    start, end = bounds(ent)
    sub, created = Subscription.objects.get_or_create(organization=org, defaults={"plan": tier.plan, "access_type": "lifetime", "current_period_start": start, "current_period_end": end})
    sub.plan = tier.plan
    sub.access_type = "lifetime"
    sub.current_period_start, sub.current_period_end = start, end
    if first or sub.status == "expired":
        sub.status = "active"
    sub.save()
    ent.status = "active"
    ent.save(update_fields=["tier", "status"])


@transaction.atomic
def redeem(org, actor, raw_code, *, enforce_flag=True):
    if enforce_flag and not getattr(settings, "APPSUMO_REDEMPTION_ENABLED", False):
        if not (getattr(settings, "APPSUMO_OWNER_SMOKE_ENABLED", False) and actor.is_superuser):
            fail("disabled", "AppSumo redemption is not open yet.")
    if actor.role != "admin" or actor.organization_id != org.pk:
        fail("ineligible_role", "Only this workspace's administrator can redeem codes.")
    org = Organization.objects.select_for_update().get(pk=org.pk)
    code = AppSumoCode.objects.select_for_update().select_related("batch__offer").filter(digest=digest(normalize(raw_code))).first()
    if not code:
        fail("invalid_code", "This AppSumo code is invalid.")
    if code.revoked:
        fail("revoked_code", "This code has been revoked. Contact support.")
    if code.organization_id:
        if code.organization_id == org.pk:
            return summary(org)
        fail("already_used", "This code has already been redeemed.")
    if not code.batch.active or code.batch.environment != getattr(settings, "APPSUMO_ENVIRONMENT", "test"):
        fail("invalid_code", "This AppSumo code is unavailable in this environment.")
    if org.status == "suspended":
        fail("suspended_organization", "Contact support to resolve your workspace suspension.")
    ent = entitlement_for(org)
    sub = Subscription.objects.filter(organization=org).select_related("plan").first()
    if sub and sub.status == "suspended":
        fail("suspended_organization", "Contact support to resolve your subscription suspension.")
    if not ent and sub and sub.status == "active" and not sub.plan.is_free and sub.current_period_end > timezone.now():
        fail("active_paid_subscription", "Create a separate AppSumo workspace using a different email address.")
    if ent and ent.offer_id != code.batch.offer_id:
        fail("offer_mismatch", "This code belongs to a different offer version.")
    count = AppSumoCode.objects.filter(organization=org, revoked=False).count()
    if count >= 5:
        fail("tier_maximum", "Tier 5 is the highest tier. This code has not been consumed.")
    first = not ent
    if first:
        ent = AppSumoEntitlement.objects.create(organization=org, offer=code.batch.offer, activated_at=timezone.now(), terms_snapshot=code.batch.offer.terms)
    code.organization = org
    code.redeemed_by = actor
    code.redeemed_at = timezone.now()
    code.save(update_fields=["organization", "redeemed_by", "redeemed_at"])
    ent.tier = count + 1
    apply_entitlement(ent, first=first)
    audit("code_redeemed", actor, code.pk, organization_id=org.pk, tier=ent.tier)
    from .tasks import send_appsumo_activation_email
    transaction.on_commit(lambda: send_appsumo_activation_email.delay(actor.pk, ent.tier), robust=True)
    return summary(org)


@transaction.atomic
def revoke(code_id, actor, reference, reason, *, reinstate=False):
    # Use the same organization-before-code lock order as redemption.
    initial = AppSumoCode.objects.get(pk=code_id)
    if initial.organization_id:
        Organization.objects.select_for_update().get(pk=initial.organization_id)
    code = AppSumoCode.objects.select_for_update().get(pk=code_id)
    if code.organization_id != initial.organization_id:
        fail("retry_refund", "The code was just redeemed. Retry reconciliation.")
    if code.revoked == (not reinstate):
        return
    if reinstate and code.organization_id and AppSumoCode.objects.filter(organization_id=code.organization_id, revoked=False).count() >= 5:
        fail("tier_maximum", "Reinstatement would exceed Tier 5.")
    code.revoked = not reinstate
    code.save(update_fields=["revoked"])
    if code.organization_id:
        ent = entitlement_for(code.organization)
        ent.tier = AppSumoCode.objects.filter(organization=code.organization, revoked=False).count()
        apply_entitlement(ent)
    audit("code_reinstated" if reinstate else "code_revoked", actor, code.pk, external_reference=reference, reason=reason)


@transaction.atomic
def reserve_send(org, key):
    if not entitlement_for(org):
        return None
    org = Organization.objects.select_for_update().get(pk=org.pk)
    require_productive(org)
    # A retry must resolve the original reservation, including across a reset.
    existing = AppSumoSendReservation.objects.filter(usage__organization=org, key=key).exclude(state="failed").order_by("created_at").first()
    if existing and existing.state != "failed":
        fail("send_already_reserved", "This send has already been accepted or is awaiting reconciliation.")
    state = summary(org)
    if state["usage"]["emails_remaining"] <= 0:
        fail("email_quota", "Your email allowance is exhausted until the next reset.")
    usage = usage_for(org)
    reservation, _ = AppSumoSendReservation.objects.get_or_create(usage=usage, key=key)
    reservation.state = "reserved"
    reservation.save(update_fields=["state", "updated_at"])
    return reservation.pk


@transaction.atomic
def settle_send(reservation_id, state):
    if reservation_id is None:
        return
    initial = AppSumoSendReservation.objects.select_related("usage").get(pk=reservation_id)
    Organization.objects.select_for_update().get(pk=initial.usage.organization_id)
    reservation = AppSumoSendReservation.objects.select_for_update().get(pk=reservation_id)
    if reservation.state not in ("reserved", "ambiguous"):
        return
    if state not in ("sent", "failed", "ambiguous"):
        fail("invalid_state", "Choose sent, failed, or ambiguous.")
    reservation.state = state
    reservation.save(update_fields=["state", "updated_at"])
    if state == "sent":
        usage = AppSumoUsage.objects.select_for_update().get(pk=reservation.usage_id)
        usage.emails_sent += 1
        usage.save(update_fields=["emails_sent"])


def metered_delivery(org, key, send):
    """Do not retry an uncertain external side effect automatically."""
    reservation = reserve_send(org, key) if org else None
    try:
        result = send()
    except Exception as exc:
        import smtplib
        definite = isinstance(exc, (smtplib.SMTPAuthenticationError, smtplib.SMTPRecipientsRefused,
            smtplib.SMTPSenderRefused, smtplib.SMTPDataError, ConnectionRefusedError))
        settle_send(reservation, "failed" if definite else "ambiguous")
        raise
    if isinstance(result, dict) and not result.get("ok", True):
        definite = result.get("stage") in ("validation", "connect", "auth", "configuration")
        settle_send(reservation, "failed" if definite else "ambiguous")
    else:
        settle_send(reservation, "sent")
    return result


@transaction.atomic
def import_leads(org, actor, data):
    import json
    from django.core.validators import validate_email
    from django.core.exceptions import ValidationError as DjangoValidationError
    from recipients.models import Recipient, RecipientList
    from .models import AppSumoImportReceipt
    if actor.role not in ("admin", "manager"):
        fail("ineligible_role", "Only administrators and managers can import contacts.")
    org = Organization.objects.select_for_update().get(pk=org.pk)
    require_productive(org)
    key = str(data.get("idempotency_key", "")).strip()
    if not key or len(key) > 128:
        fail("update_required", "Update Lead Hunter to send a batch identifier.")
    payload_hash = hashlib.sha256(json.dumps(data, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    receipt = AppSumoImportReceipt.objects.filter(organization=org, key=key).first()
    if receipt:
        if receipt.payload_digest != payload_hash:
            fail("idempotency_conflict", "This batch identifier was used with different contacts.")
        return receipt.result
    leads = data.get("leads")
    if not isinstance(leads, list) or not 1 <= len(leads) <= 250:
        fail("batch_limit", "Submit between 1 and 250 contacts per batch.")
    list_id = data.get("list_id") or data.get("recipient_list")
    if list_id:
        recipient_list = RecipientList.objects.filter(pk=list_id, organization=org).first()
        if not recipient_list:
            fail("invalid_list", "Choose a recipient list in this workspace.")
    else:
        recipient_list, _ = RecipientList.objects.get_or_create(organization=org,
            list_name=str(data.get("list_name") or "Lead Hunter")[:255], defaults={"created_by": actor})
    usage = usage_for(org)
    limits = tier_for(entitlement_for(org)).limits
    remaining = min(limits["contacts"] - org.recipients.count(), limits["imports"] - usage.imports, 250)
    existing = set(recipient_list.recipients.values_list("email", flat=True))
    seen = {e.lower() for e in existing}
    rows, invalid, duplicates, skipped = [], 0, 0, 0
    for lead in leads:
        if not isinstance(lead, dict):
            invalid += 1
            continue
        emails = lead.get("emails") or lead.get("email") or []
        if isinstance(emails, str):
            emails = emails.replace(";", ",").split(",")
        if not isinstance(emails, list):
            invalid += 1
            continue
        for email in emails:
            email = str(email).strip().lower()
            try:
                validate_email(email)
            except DjangoValidationError:
                invalid += 1
                continue
            if email in seen:
                duplicates += 1
                continue
            seen.add(email)
            if len(rows) >= remaining:
                skipped += 1
                continue
            rows.append(Recipient(organization=org, recipient_list=recipient_list, email=email,
                name=str(lead.get("name") or email.split("@")[0])[:255], company=str(lead.get("company") or "")[:255],
                phone=str(lead.get("phone") or "")[:50], metadata={"source": "lead_hunter"}, status="active"))
    Recipient.objects.bulk_create(rows)
    usage.imports += len(rows)
    usage.save(update_fields=["imports"])
    result = {"ok": True, "list_id": recipient_list.pk, "list_name": recipient_list.list_name,
        "inserted": len(rows), "duplicates": duplicates, "invalid": invalid, "skipped": skipped,
        "total_processed": len(leads), "quota_warning": "Some contacts exceeded your allowance." if skipped else None,
        "quota": lead_hunter_quota(org, actor)}
    AppSumoImportReceipt.objects.create(organization=org, key=key, payload_digest=payload_hash, result=result)
    return result


def lead_hunter_quota(org, actor):
    state = summary(org)
    limits = state["limits"]
    return {"access_type": "lifetime", "plan_name": f'AppSumo Lifetime Tier {state["tier"]}',
        "max_recipients": limits["contacts"], "current_recipients": org.recipients.count(),
        "available_slots": max(0, limits["contacts"] - org.recipients.count()), "max_batch_limit": 250,
        "imports_remaining": state["usage"]["imports_remaining"], "import_limit": limits["imports"],
        "usage_reset_at": state["period_end"].isoformat(), "user_id": actor.pk, "organization_id": org.pk,
        "device_limit": 2, "can_import": actor.role in ("admin", "manager")}
