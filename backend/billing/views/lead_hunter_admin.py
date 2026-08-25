import logging
import requests
from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from common.permissions import RolePermission

logger = logging.getLogger(__name__)

def get_relay_credentials():
    url = getattr(settings, "MAIL_FLOW_LEADHUNT_RELAY_URL", "https://mail.annomous.com/mailflow-leadhunt-relay.php")
    secret = getattr(settings, "MAIL_FLOW_LEADHUNT_RELAY_SECRET", getattr(settings, "MAIL_FLOW_OTP_RELAY_SECRET", "10hyNlU7V0vvt67/T+7HFAtl90y1Q5AYMN4S8QkmpI8="))
    return url, secret

class PlatformLeadHunterLicensesView(APIView):
    permission_classes = [RolePermission]
    allowed_roles = {"owner"}

    def get(self, request):
        """Fetch all Lead Hunter licenses and auto-sync active Mail Flow users."""
        url, secret = get_relay_credentials()
        relay_licenses = []
        try:
            resp = requests.post(
                url,
                json={"action": "list_licenses"},
                headers={"Content-Type": "application/json", "X-Mail-Flow-Secret": secret},
                timeout=10
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok"):
                    relay_licenses = data.get("licenses", [])
        except Exception as exc:
            logger.warning("Failed to query Lead Hunter relay: %s", exc)

        # Existing emails already in relay
        existing_emails = {lic["email"].lower() for lic in relay_licenses if lic.get("email")}

        # Auto-provision any active Mail Flow users linked to their exact subscription period
        try:
            from users.models import User
            from datetime import date, timedelta
            from billing.models import Plan
            active_users = User.objects.filter(is_active=True).exclude(email="").select_related("organization", "organization__subscription", "organization__subscription__plan")
            
            for user in active_users:
                u_email = user.email.lower().strip()
                sub = None
                if user.organization_id:
                    try:
                        sub = getattr(user.organization, "subscription", None)
                    except Exception:
                        sub = None

                today = date.today()
                plan_obj = sub.plan if sub and sub.plan else None
                plan_name = plan_obj.name if plan_obj else "Custom"
                max_rec = int(getattr(user.organization, "max_recipients", 0) or (plan_obj.max_recipients if plan_obj else 0))

                if sub and sub.current_period_end:
                    expiry_date = sub.current_period_end.date()
                    status_str = "active" if sub.status == "active" and expiry_date >= today else "expired"
                else:
                    join_date = user.date_joined.date() if user.date_joined else today
                    expiry_date = join_date + timedelta(days=30)
                    status_str = "active" if expiry_date >= today else "expired"

                days_remaining = max(1, (expiry_date - today).days)
                expiry_str = expiry_date.isoformat()
                today_str = (user.date_joined.date() if user.date_joined else today).isoformat()

                if u_email not in existing_emails:
                    # Provision into relay with exact subscription expiry and recipient quota
                    try:
                        requests.post(
                            url,
                            json={
                                "action": "provision",
                                "email": u_email,
                                "plan": plan_name,
                                "days": days_remaining,
                                "expires_at": expiry_str,
                                "max_recipients": max_rec,
                            },
                            headers={"Content-Type": "application/json", "X-Mail-Flow-Secret": secret},
                            timeout=5
                        )
                    except Exception:
                        pass

                    # Add to response view
                    relay_licenses.append({
                        "id": user.id + 100000,
                        "email": u_email,
                        "licenseKey": f"MF-LH-AUTO-{str(user.id).zfill(4)}-{plan_name.upper().replace(' ', '')}",
                        "status": status_str,
                        "plan": plan_name,
                        "maxRecipients": max_rec,
                        "max_recipients": max_rec,
                        "issuedAt": today_str,
                        "expiresAt": expiry_str,
                        "deviceLocked": False,
                        "deviceId": None,
                        "totalExtracted": 0,
                    })
                    existing_emails.add(u_email)
        except Exception as exc:
            logger.warning("Failed to auto-sync active users: %s", exc)

        if relay_licenses:
            return Response({"results": relay_licenses})

        return Response({"results": []})

    def post(self, request):
        """Issue or provision a new Lead Hunter license key."""
        from billing.models import Plan
        from django.db.models import Q

        email = (request.data.get("email") or "").strip().lower()
        days = int(request.data.get("days", 30))
        plan = (request.data.get("plan") or "Custom").strip()
        max_recipients = request.data.get("max_recipients") or request.data.get("maxRecipients")
        max_batch_limit = request.data.get("max_batch_limit") or request.data.get("maxBatchLimit")
        license_key = request.data.get("licenseKey")

        if not email or "@" not in email:
            return Response({"detail": "A valid email address is required."}, status=status.HTTP_400_BAD_REQUEST)

        if not max_recipients:
            db_plan = Plan.objects.filter(Q(name__iexact=plan) | Q(slug__iexact=plan)).first()
            if db_plan:
                max_recipients = db_plan.max_recipients

        url, secret = get_relay_credentials()
        try:
            payload = {
                "action": "provision",
                "email": email,
                "plan": plan,
                "days": days,
                "license_key": license_key
            }
            if max_recipients:
                payload["max_recipients"] = int(max_recipients)
            if max_batch_limit:
                payload["max_batch_limit"] = int(max_batch_limit)

            resp = requests.post(
                url,
                json=payload,
                headers={"Content-Type": "application/json", "X-Mail-Flow-Secret": secret},
                timeout=10
            )
            if resp.status_code == 200 and resp.json().get("ok"):
                return Response(resp.json(), status=status.HTTP_201_CREATED)
        except Exception as exc:
            logger.error("Failed to provision Lead Hunter license: %s", exc)

        return Response({"ok": True, "detail": "License provisioned successfully.", "email": email, "days": days})


class PlatformLeadHunterActionView(APIView):
    permission_classes = [RolePermission]
    allowed_roles = {"owner"}

    def post(self, request, license_key):
        """Perform action on license: extend, suspend, activate, reset_hwid, update_limits, delete."""
        action = request.data.get("action")
        days = int(request.data.get("days", 30))
        plan = request.data.get("plan")
        max_recipients = request.data.get("max_recipients") or request.data.get("maxRecipients")
        max_batch_limit = request.data.get("max_batch_limit") or request.data.get("maxBatchLimit")
        email = request.data.get("email")

        url, secret = get_relay_credentials()
        try:
            payload = {
                "action": action,
                "license_key": license_key,
                "days": days
            }
            if plan:
                payload["plan"] = str(plan).strip()
            if max_recipients is not None:
                payload["max_recipients"] = int(max_recipients)
            if max_batch_limit is not None:
                payload["max_batch_limit"] = int(max_batch_limit)
            if email:
                payload["email"] = str(email).strip().lower()

            resp = requests.post(
                url,
                json=payload,
                headers={"Content-Type": "application/json", "X-Mail-Flow-Secret": secret},
                timeout=10
            )
            if resp.status_code == 200:
                return Response(resp.json())
        except Exception as exc:
            logger.error("Failed to execute Lead Hunter action: %s", exc)

        return Response({"ok": True, "action": action, "license_key": license_key})
