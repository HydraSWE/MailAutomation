from datetime import date
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from .models import Organization, OrganizationUsage


MESSAGES = {
    "inactive": "Account is suspended. Contact support.",
    "daily": "Daily email quota exceeded.",
    "monthly": "Monthly email quota exceeded.",
    "campaigns": "Daily campaign limit reached for this account.",
}


def usage_snapshot(organization, on_date=None):
    on_date = on_date or timezone.localdate()
    daily = OrganizationUsage.objects.filter(organization=organization, date=on_date).first()
    monthly = OrganizationUsage.objects.filter(
        organization=organization, date__year=on_date.year, date__month=on_date.month
    ).aggregate(sent=Sum("emails_sent"), failed=Sum("emails_failed"), campaigns=Sum("campaigns_launched"))
    daily_sent = daily.emails_sent if daily else 0
    monthly_sent = monthly["sent"] or 0
    return {
        "date": on_date,
        "daily_sent": daily_sent,
        "daily_remaining": max(organization.daily_email_limit - daily_sent, 0),
        "monthly_sent": monthly_sent,
        "monthly_remaining": max(organization.monthly_email_limit - monthly_sent, 0),
        "campaigns_today": daily.campaigns_launched if daily else 0,
        "campaigns_remaining": max(organization.max_campaigns_per_day - (daily.campaigns_launched if daily else 0), 0),
        "emails_failed_today": daily.emails_failed if daily else 0,
    }


def validate_organization_active(organization):
    if organization.status != Organization.Status.ACTIVE:
        raise ValidationError({"detail": MESSAGES["inactive"]})


def validate_email_quota(organization, requested):
    validate_organization_active(organization)
    usage = usage_snapshot(organization)
    if requested > usage["daily_remaining"]:
        raise ValidationError({"detail": MESSAGES["daily"]})
    if requested > usage["monthly_remaining"]:
        raise ValidationError({"detail": MESSAGES["monthly"]})
    return usage


@transaction.atomic
def record_campaign_launch(organization_id):
    organization = Organization.objects.select_for_update().get(pk=organization_id)
    validate_organization_active(organization)
    usage, _ = OrganizationUsage.objects.select_for_update().get_or_create(
        organization=organization, date=timezone.localdate()
    )
    if usage.campaigns_launched >= organization.max_campaigns_per_day:
        raise ValidationError({"detail": MESSAGES["campaigns"]})
    usage.campaigns_launched += 1
    usage.save(update_fields=["campaigns_launched"])


@transaction.atomic
def record_email_result(organization_id, *, sent):
    usage, _ = OrganizationUsage.objects.select_for_update().get_or_create(
        organization_id=organization_id, date=timezone.localdate()
    )
    field = "emails_sent" if sent else "emails_failed"
    setattr(usage, field, getattr(usage, field) + 1)
    usage.save(update_fields=[field])
