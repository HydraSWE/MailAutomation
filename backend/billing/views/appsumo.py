import csv
import io
import re
import secrets
from datetime import timedelta
from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.db import transaction, IntegrityError, OperationalError, ProgrammingError
from django.db.models import Count
from django.http import HttpResponse
from django.utils import timezone
from django.views.decorators.debug import sensitive_post_parameters
from django.utils.decorators import method_decorator
from rest_framework import serializers
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle
from common.permissions import OwnerOnly
from common.models import Organization
from users.models import User
from .common import CsrfProtectedAPIView
from .. import appsumo as service
from ..models import (AppSumoOffer, AppSumoBatch, AppSumoCode, AppSumoAudit,
    AppSumoSignupChallenge, AppSumoRefundPreview, AppSumoSendReservation)


@method_decorator(sensitive_post_parameters("code", "password", "otp", "csv"), name="dispatch")
class AppSumoView(CsrfProtectedAPIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "appsumo"


class OffersView(AppSumoView):
    permission_classes = [AllowAny]

    def get(self, request):
        offers = AppSumoOffer.objects.filter(published=True).prefetch_related("tiers")
        return Response({"redemption_enabled": settings.APPSUMO_REDEMPTION_ENABLED, "offers": [
            {"id": o.pk, "version": o.version, "terms": o.terms, "tiers": [
                {"tier": t.tier, "price_usd": str(t.price_usd), "limits": t.limits} for t in o.tiers.all()]} for o in offers]})


class SignupStartView(AppSumoView):
    throttle_scope = "appsumo_signup"
    permission_classes = [AllowAny]

    def post(self, request):
        if not settings.APPSUMO_REDEMPTION_ENABLED:
            service.fail("disabled", "AppSumo redemption is not open yet.")
        email = serializers.EmailField().run_validation(request.data.get("email")).lower()
        from ..services.turnstile import verify_turnstile
        verify_turnstile(request.data.get("turnstile_token", ""), request)
        if User.objects.filter(email__iexact=email).exists():
            service.fail("existing_account", "Sign in to redeem for an existing account.")
        otp = f"{secrets.randbelow(1000000):06d}"
        with transaction.atomic():
            AppSumoSignupChallenge.objects.filter(email=email, used_at__isnull=True).update(used_at=timezone.now())
            challenge = AppSumoSignupChallenge.objects.create(email=email, digest=service.digest(otp), expires_at=timezone.now() + timedelta(minutes=10))
            from ..tasks import send_checkout_otp_email
            transaction.on_commit(lambda: send_checkout_otp_email.delay(email, otp))
        return Response({"challenge_id": str(challenge.pk), "detail": "Check your email for the verification code."}, status=202)


class SignupCompleteView(AppSumoView):
    throttle_scope = "appsumo_signup"
    permission_classes = [AllowAny]

    def post(self, request):
        if not settings.APPSUMO_REDEMPTION_ENABLED:
            service.fail("disabled", "AppSumo redemption is not open yet.")
        data = request.data
        email = serializers.EmailField().run_validation(data.get("email")).lower()
        password = serializers.CharField(min_length=8, max_length=128, trim_whitespace=False).run_validation(data.get("password"))
        name = serializers.CharField(max_length=150).run_validation(data.get("name"))
        username = serializers.CharField(required=False, allow_blank=True, max_length=150).run_validation(data.get("username", ""))
        username = (username or "").strip()
        if username:
            if len(username) < 3:
                raise serializers.ValidationError({"username": "Username must be at least 3 characters long."})
            if not re.match(r"^[a-zA-Z0-9_.-]+$", username):
                raise serializers.ValidationError({"username": "Username may only contain letters, numbers, underscores, dots, and hyphens."})
            if User.objects.filter(username__iexact=username).exists():
                raise serializers.ValidationError({"username": "This username is already taken."})
        org_name = serializers.CharField(max_length=255).run_validation(data.get("organization_name"))
        from django.core.exceptions import ValidationError as PasswordValidationError
        try:
            validate_password(password, User(email=email, name=name))
        except PasswordValidationError as exc:
            raise serializers.ValidationError({"password": exc.messages})
        challenge_id = serializers.UUIDField().run_validation(data.get("challenge_id"))
        invalid = False
        # Commit failed attempt counts independently of the registration transaction.
        with transaction.atomic():
            challenge = AppSumoSignupChallenge.objects.select_for_update().filter(pk=challenge_id, email=email).first()
            if not challenge or challenge.used_at or challenge.expires_at <= timezone.now() or challenge.attempts >= 5:
                invalid = True
            elif not secrets.compare_digest(challenge.digest, service.digest(str(data.get("otp", "")))):
                challenge.attempts += 1
                challenge.save(update_fields=["attempts"])
                invalid = True
        if invalid:
            service.fail("verification_failed", "Verification code is invalid or expired.")
        try:
            with transaction.atomic():
                challenge = AppSumoSignupChallenge.objects.select_for_update().get(pk=challenge_id)
                if challenge.used_at or challenge.expires_at <= timezone.now() or challenge.attempts >= 5:
                    service.fail("verification_failed", "Verification code is invalid or expired.")
                if User.objects.filter(email__iexact=email).exists():
                    service.fail("existing_account", "Sign in to your existing account.")
                if username and User.objects.filter(username__iexact=username).exists():
                    raise serializers.ValidationError({"username": "This username is already taken."})
                org = Organization.objects.create(name=org_name)
                user = User.objects.create_user(username=username or "sumo_" + secrets.token_hex(12), email=email, name=name, password=password, role="admin", organization=org)
                org.created_by = user
                org.save(update_fields=["created_by"])
                result = service.redeem(org, user, data.get("code", ""))
                challenge.used_at = timezone.now()
                challenge.save(update_fields=["used_at"])
                from ..services.notifications import queue_account_created_email
                transaction.on_commit(lambda: queue_account_created_email(user.pk))
        except IntegrityError:
            service.fail("account_conflict", "The email or workspace name is already in use. Sign in or choose another workspace name.")
        return Response({"detail": "Lifetime access activated. Sign in to your account.", "login_url": "/login", "entitlement": result}, status=201)


class RedeemView(AppSumoView):
    def post(self, request):
        if not request.user.organization_id:
            service.fail("ineligible_role", "A customer workspace is required.")
        return Response(service.redeem(request.user.organization, request.user, request.data.get("code", "")))


class EntitlementView(AppSumoView):
    def get(self, request):
        if not request.user.organization_id:
            return Response({"access_type": "recurring"})
        return Response(service.summary(request.user.organization))


class LeadHunterEntitlementView(APIView):
    """Relay-only entitlement lookup, including revoked/disabled memberships."""
    permission_classes = [AllowAny]

    def post(self, request):
        import hmac
        expected = getattr(settings, "MAIL_FLOW_LEADHUNT_RELAY_SECRET", "") or getattr(settings, "MAIL_FLOW_OTP_RELAY_SECRET", "")
        supplied = request.headers.get("X-Mail-Flow-Secret", "")
        if not expected or not hmac.compare_digest(expected, supplied):
            return Response({"ok": False}, status=403)
        user = User.objects.filter(email__iexact=str(request.data.get("email", "")).strip()).select_related("organization").first()
        if not user or not user.organization_id:
            return Response({"ok": True, "access_type": "unknown", "active": False})
        state = service.resolve(user.organization)
        if state["access_type"] != "lifetime":
            return Response({"ok": True, "access_type": "recurring"})
        active = state["active"] and user.is_active
        return Response({"ok": True, "access_type": "lifetime", "active": active,
            "quota": service.lead_hunter_quota(user.organization, user) if active else None})


class OwnerAppSumoView(AppSumoView):
    permission_classes = [OwnerOnly]

    def get(self, request):
        offset = serializers.IntegerField(min_value=0, max_value=10000000).run_validation(request.query_params.get("offset", 0))
        try:
            batches = AppSumoBatch.objects.annotate(code_count=Count("codes")).order_by("-created_at")
            return Response({"batches": list(batches.values("id", "offer_id", "environment", "active", "created_at", "code_count")[:100]),
                "code_count": AppSumoCode.objects.count(), "offset": offset,
                "flags": {"smoke": settings.APPSUMO_OWNER_SMOKE_ENABLED, "code_admin": settings.APPSUMO_CODE_ADMIN_ENABLED},
                "codes": list(AppSumoCode.objects.order_by("id").values("id", "masked_code", "batch_id", "organization_id", "redeemed_at", "revoked")[offset:offset+200]),
                "audit": list(AppSumoAudit.objects.order_by("-created_at").values()[:100]),
                "unresolved_sends": list(AppSumoSendReservation.objects.filter(state__in=["reserved", "ambiguous"]).values("id", "usage__organization_id", "state", "created_at")[:100]),
                "unused_codes": AppSumoCode.objects.filter(organization__isnull=True, revoked=False, batch__environment="production", batch__active=True).count()})
        except (OperationalError, ProgrammingError):
            return Response({"code": "appsumo_migrations_pending", "detail": "AppSumo tables are not ready. Apply billing migrations before using the owner console."}, status=503)

    def post(self, request):
        action = request.data.get("action")
        if action == "lookup":
            code = AppSumoCode.objects.filter(digest=service.digest(service.normalize(request.data.get("code", "")))).values("id", "masked_code", "batch_id", "organization_id", "redeemed_at", "revoked").first()
            if not code:
                service.fail("invalid_code", "Code record not found.")
            return Response({"code": code})
        if action == "smoke_redeem":
            if not settings.APPSUMO_OWNER_SMOKE_ENABLED:
                service.fail("disabled", "Owner smoke testing is disabled.")
            org_id = serializers.IntegerField().run_validation(request.data.get("organization_id"))
            org = Organization.objects.filter(pk=org_id).first()
            actor = User.objects.filter(organization=org, role="admin", is_active=True).first() if org else None
            if not actor:
                service.fail("invalid_workspace", "Choose a smoke-test workspace with an active administrator.")
            with transaction.atomic():
                result = service.redeem(org, actor, request.data.get("code", ""), enforce_flag=False)
                service.audit("owner_smoke_redemption", request.user, org.pk)
            return Response(result)
        if action == "generate":
            offer_id = serializers.IntegerField().run_validation(request.data.get("offer_id"))
            count = serializers.IntegerField(min_value=1, max_value=10000).run_validation(request.data.get("count", 1000))
            offer = AppSumoOffer.objects.filter(pk=offer_id, published=True).first()
            if not offer:
                service.fail("invalid_offer", "Choose a published offer.")
            batch = service.generate_batch(offer, request.data.get("environment"), request.user, count=count)
            return Response({"batch_id": str(batch.pk), "count": count}, status=201)
        if action in ("activate_batch", "deactivate_batch", "export"):
            batch_id = serializers.UUIDField().run_validation(request.data.get("batch_id"))
            batch = AppSumoBatch.objects.filter(pk=batch_id).first()
            if not batch:
                service.fail("invalid_batch", "Batch not found.")
            if action == "export":
                response = HttpResponse(service.export_batch(batch, request.user), content_type="text/csv")
                response["Content-Disposition"] = f'attachment; filename="MailFlow-AppSumo-{batch.pk}.csv"'
                response["Cache-Control"] = "no-store"
                return response
            batch.active = action == "activate_batch"
            batch.save(update_fields=["active"])
            service.audit(action, request.user, batch.pk)
        elif action in ("revoke", "reinstate"):
            code_id = serializers.UUIDField().run_validation(request.data.get("code_id"))
            reference = serializers.CharField(max_length=128).run_validation(request.data.get("reference"))
            reason = serializers.CharField(max_length=500).run_validation(request.data.get("reason"))
            if not AppSumoCode.objects.filter(pk=code_id).exists():
                service.fail("invalid_code", "Code record not found.")
            service.revoke(code_id, request.user, reference, reason, reinstate=action == "reinstate")
        elif action == "refund_preview":
            raw = serializers.CharField(max_length=250000).run_validation(request.data.get("csv"))
            reader = csv.DictReader(io.StringIO(raw))
            if reader.fieldnames != ["code", "reference", "reason"]:
                service.fail("invalid_csv", "CSV headers must be code,reference,reason.")
            rows = []
            for row in reader:
                if len(rows) >= 1000:
                    service.fail("invalid_csv", "Use at most 1,000 rows.")
                raw_code = service.normalize(row.get("code", ""))
                code = AppSumoCode.objects.filter(digest=service.digest(service.normalize(raw_code))).first()
                if not code or not row.get("reference") or not row.get("reason"):
                    service.fail("invalid_csv", "A row has an unknown code or missing reference/reason.")
                rows.append({"code_id": str(code.pk), "masked_code": code.masked_code,
                    "reference": row["reference"][:128], "reason": row["reason"][:500]})
            if not rows or len({r["code_id"] for r in rows}) != len(rows):
                service.fail("invalid_csv", "Use unique codes and at least one row.")
            preview = AppSumoRefundPreview.objects.create(actor=request.user, rows=rows, expires_at=timezone.now() + timedelta(minutes=20))
            return Response({"preview_id": str(preview.pk), "rows": rows})
        elif action == "refund_confirm":
            preview_id = serializers.UUIDField().run_validation(request.data.get("preview_id"))
            with transaction.atomic():
                preview = AppSumoRefundPreview.objects.select_for_update().filter(pk=preview_id, actor=request.user, expires_at__gt=timezone.now()).first()
                if not preview:
                    service.fail("invalid_preview", "Preview expired. Upload and review the CSV again.")
                if not preview.committed_at:
                    # Acquire all workspace locks in stable order before code locks.
                    ids = AppSumoCode.objects.filter(pk__in=[r["code_id"] for r in preview.rows]).exclude(organization=None).values_list("organization_id", flat=True)
                    list(Organization.objects.select_for_update().filter(pk__in=ids).order_by("pk"))
                    for row in preview.rows:
                        service.revoke(row["code_id"], request.user, row["reference"], row["reason"])
                    preview.committed_at = timezone.now()
                    preview.save(update_fields=["committed_at"])
        elif action == "resolve_send":
            reservation_id = serializers.IntegerField().run_validation(request.data.get("reservation_id"))
            state = serializers.ChoiceField(choices=["sent", "failed"]).run_validation(request.data.get("state"))
            reason = serializers.CharField(max_length=500).run_validation(request.data.get("reason"))
            if not AppSumoSendReservation.objects.filter(pk=reservation_id).exists():
                service.fail("invalid_reservation", "Reservation not found.")
            service.settle_send(reservation_id, state)
            service.audit("send_resolved", request.user, reservation_id, state=state, reason=reason)
        else:
            service.fail("invalid_action", "Unknown AppSumo action.")
        return Response({"ok": True})
