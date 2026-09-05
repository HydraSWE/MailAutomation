"""Read-only operational counters. Never prints redemption code material."""
import json
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from billing.models import AppSumoCode, AppSumoEntitlement, AppSumoRefundPreview, AppSumoSendReservation, Subscription


class Command(BaseCommand):
    help = "Print AppSumo inventory and reconciliation health as JSON."

    def handle(self, *args, **options):
        stale = timezone.now() - timedelta(hours=1)
        self.stdout.write(json.dumps({
            "unused_active_production_codes": AppSumoCode.objects.filter(organization__isnull=True, revoked=False, batch__active=True, batch__environment="production").count(),
            "ambiguous_sends": AppSumoSendReservation.objects.filter(state="ambiguous").count(),
            "reservations_older_than_hour": AppSumoSendReservation.objects.filter(state="reserved", created_at__lt=stale).count(),
            "unconfirmed_refund_previews": AppSumoRefundPreview.objects.filter(committed_at__isnull=True, expires_at__gt=timezone.now()).count(),
            "active_entitlements_with_expired_subscription": AppSumoEntitlement.objects.filter(status="active", organization_id__in=Subscription.objects.filter(access_type="lifetime", status="expired").values("organization_id")).count(),
        }))
