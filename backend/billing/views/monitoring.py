from .common import *  # noqa: F401,F403

class PublicLandingMonitorView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        from datetime import timedelta
        from django.db.models import Q
        from billing.configuration import get_billing_configuration
        from campaigns.models import CampaignLog
        from smtp_manager.models import SMTPAccount

        config = get_billing_configuration()
        if not getattr(config, "public_landing_monitor_active", True):
            return Response({
                "is_active": False,
                "message": "Mail Flow is inactive - data not available",
            })

        now = timezone.now()
        thirty_days_ago = now - timedelta(days=30)

        # 30-day server-wide stats
        sent_logs = CampaignLog.objects.filter(
            status=CampaignLog.Status.SENT,
            created_at__gte=thirty_days_ago
        )
        failed_logs = CampaignLog.objects.filter(
            status=CampaignLog.Status.FAILED,
            created_at__gte=thirty_days_ago
        )
        delivered_count = sent_logs.count()
        failed_count = failed_logs.count()
        total_attempts = delivered_count + failed_count

        if total_attempts > 0:
            success_rate = round((delivered_count / total_attempts) * 100, 1)
        else:
            success_rate = 100.0

        in_queue_count = CampaignLog.objects.filter(
            status__in=[CampaignLog.Status.PENDING, CampaignLog.Status.PROCESSING]
        ).count()

        # 12-day breakdown
        daily_bars = []
        for i in range(11, -1, -1):
            day_date = (now - timedelta(days=i)).date()
            day_start = timezone.make_aware(timezone.datetime.combine(day_date, timezone.datetime.min.time()))
            day_end = timezone.make_aware(timezone.datetime.combine(day_date, timezone.datetime.max.time()))

            day_sent = CampaignLog.objects.filter(
                status=CampaignLog.Status.SENT,
                created_at__gte=day_start,
                created_at__lte=day_end
            ).count()

            day_failed = CampaignLog.objects.filter(
                status=CampaignLog.Status.FAILED,
                created_at__gte=day_start,
                created_at__lte=day_end
            ).count()

            daily_bars.append({
                "date": day_date.strftime("%Y-%m-%d"),
                "label": day_date.strftime("%b %d"),
                "delivered": day_sent,
                "failed": day_failed,
                "total": day_sent + day_failed,
            })

        max_day_volume = max([d["total"] for d in daily_bars] or [0])
        for bar in daily_bars:
            if max_day_volume > 0:
                bar["percentage"] = max(15, round((bar["total"] / max_day_volume) * 100))
            else:
                bar["percentage"] = 25  # pleasant baseline aesthetic if no dispatch on that day

        # SMTP Relay Health
        active_routes = SMTPAccount.objects.filter(status=True).count()
        delivery_incidents = failed_count

        return Response({
            "is_active": True,
            "metrics": {
                "delivered": delivered_count,
                "success_rate": success_rate,
                "in_queue": in_queue_count,
            },
            "daily_bars": daily_bars,
            "relay_health": {
                "active_routes": active_routes,
                "delivery_incidents": delivery_incidents,
            },
        })


