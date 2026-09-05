from datetime import timedelta
from unittest.mock import patch
from django.test import TestCase, override_settings
from django.test import TransactionTestCase, skipUnlessDBFeature
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient
from common.models import Organization
from users.models import User
from .models import AppSumoOffer, AppSumoBatch, AppSumoCode, AppSumoEntitlement, Subscription, Plan
from . import appsumo as s


@override_settings(APPSUMO_CODE_KEY="test-only-persistent-key-32-characters", APPSUMO_REDEMPTION_ENABLED=True, APPSUMO_ENVIRONMENT="test")
class AppSumoTests(TestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.org = Organization.objects.create(name="Sumo test")
        self.user = User.objects.create_user(username="sumotest", email="sumo@example.com", password="test", organization=self.org, role="admin")
        self.offer = AppSumoOffer.objects.get(version="2026-v1")
        self.batch = AppSumoBatch.objects.create(offer=self.offer, environment="test", active=True)

    def code(self, n):
        raw = f"{n:040X}"
        code = AppSumoCode.objects.create(batch=self.batch, digest=s.digest(raw), encrypted_code=s._fernet().encrypt(raw.encode()).decode(), masked_code="****" + raw[-6:])
        return raw, code

    def activate(self):
        raw, code = self.code(1)
        return s.redeem(self.org, self.user, raw), code

    def test_tiers_and_idempotency(self):
        for i, emails in enumerate([5000,10000,20000,35000,50000], 1):
            raw, code = self.code(i)
            state = s.redeem(self.org, self.user, raw.lower())
            self.assertEqual(state["tier"], i)
            self.assertEqual(state["limits"]["emails"], emails)
            self.assertEqual(s.redeem(self.org, self.user, raw)["tier"], i)
        raw, code = self.code(6)
        with self.assertRaises(ValidationError):
            s.redeem(self.org, self.user, raw)
        code.refresh_from_db()
        self.assertIsNone(code.organization_id)

    def test_other_organization_cannot_reuse(self):
        self.activate()
        org = Organization.objects.create(name="Other")
        actor = User.objects.create_user(username="other", organization=org, role="admin")
        with self.assertRaises(ValidationError):
            s.redeem(org, actor, f"{1:040X}")

    def test_regular_paid_blocked(self):
        plan = Plan.objects.filter(channel="direct", is_free=False).first()
        Subscription.objects.create(organization=self.org, plan=plan, current_period_start=timezone.now(), current_period_end=timezone.now()+timedelta(days=30))
        raw, code = self.code(1)
        with self.assertRaises(ValidationError):
            s.redeem(self.org, self.user, raw)
        self.assertFalse(AppSumoEntitlement.objects.filter(organization=self.org).exists())

    def test_renewal_window_lifetime_and_suspension(self):
        self.activate()
        ent = s.entitlement_for(self.org)
        start, end = s.bounds(ent, ent.activated_at + timedelta(days=30))
        self.assertEqual(start, ent.activated_at + timedelta(days=30))
        self.assertEqual(end, ent.activated_at + timedelta(days=60))
        with patch("django.utils.timezone.now", return_value=ent.activated_at+timedelta(days=3650)):
            self.assertTrue(s.resolve(self.org)["active"])
            self.org.status = "suspended"
            self.org.save()
            with self.assertRaises(ValidationError):
                s.require_productive(self.org)

    def test_reservation_retry_reset_and_settlement(self):
        self.activate()
        rid = s.reserve_send(self.org, "campaign:1")
        s.settle_send(rid, "sent")
        s.settle_send(rid, "sent")
        self.assertEqual(s.summary(self.org)["usage"]["emails_sent"], 1)
        with self.assertRaises(ValidationError):
            s.reserve_send(self.org, "campaign:1")
        ent = s.entitlement_for(self.org)
        with patch("django.utils.timezone.now", return_value=ent.activated_at+timedelta(days=31)):
            self.assertEqual(s.summary(self.org)["usage"]["emails_sent"], 0)
            with self.assertRaises(ValidationError):
                s.reserve_send(self.org, "campaign:1")

    def test_refund_and_restore_preserve_anchor_usage(self):
        _, code = self.activate()
        rid = s.reserve_send(self.org, "mail:1")
        s.settle_send(rid, "sent")
        before = s.summary(self.org)
        s.revoke(code.pk, self.user, "refund-1", "Verified refund")
        self.assertFalse(s.summary(self.org)["active"])
        s.revoke(code.pk, self.user, "refund-1", "Correction", reinstate=True)
        after = s.summary(self.org)
        self.assertTrue(after["active"])
        self.assertEqual(before["period_start"], after["period_start"])
        self.assertEqual(after["usage"]["emails_sent"], 1)

    def test_import_deduplication_retry_and_role(self):
        self.activate()
        data = {"idempotency_key": "batch-1", "leads": [{"email": "lead@example.com"}, {"email": "lead@example.com"}, {"email": "bad"}]}
        result = s.import_leads(self.org, self.user, data)
        self.assertEqual(result["inserted"], 1)
        self.assertEqual(result["duplicates"], 1)
        self.assertEqual(result["invalid"], 1)
        self.assertEqual(result, s.import_leads(self.org, self.user, data))
        self.assertEqual(s.summary(self.org)["usage"]["imports"], 1)
        self.user.role = "viewer"
        with self.assertRaises(ValidationError):
            s.import_leads(self.org, self.user, data)

    def test_feature_and_checkout_isolation(self):
        self.activate()
        from common.plan_features import organization_support_workspace_allowed
        self.org.refresh_from_db()
        self.assertTrue(organization_support_workspace_allowed(self.org))
        with self.assertRaises(ValidationError):
            s.require_direct(self.org)
        client = APIClient()
        response = client.get("/api/billing/plans/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(any(p["slug"].startswith("appsumo") for p in response.data))

    def test_disabled_redemption_does_not_disable_access(self):
        self.activate()
        with override_settings(APPSUMO_REDEMPTION_ENABLED=False):
            self.assertTrue(s.resolve(self.org)["active"])
            raw, code = self.code(2)
            with self.assertRaises(ValidationError):
                s.redeem(self.org, self.user, raw)

    def test_test_batch_cannot_redeem_in_production(self):
        raw, code = self.code(1)
        with override_settings(APPSUMO_ENVIRONMENT="production"):
            with self.assertRaises(ValidationError):
                s.redeem(self.org, self.user, raw)

    def test_published_offer_and_tier_immutable(self):
        from django.core.exceptions import ValidationError as ModelValidationError
        with self.assertRaises(ModelValidationError):
            self.offer.save()
        with self.assertRaises(ModelValidationError):
            self.offer.tiers.first().save()

    def test_refund_capacity_hold_and_recovery(self):
        self.activate()
        raw, code = self.code(2)
        s.redeem(self.org, self.user, raw)
        member = User.objects.create_user(username="member", organization=self.org, role="manager")
        s.revoke(code.pk, self.user, "refund", "Verified")
        self.assertEqual(s.summary(self.org)["capacity_issues"][0]["resource"], "seats")
        with self.assertRaises(ValidationError):
            s.reserve_send(self.org, "held")
        member.is_active = False
        member.save()
        self.assertIsNotNone(s.reserve_send(self.org, "unheld"))

    def test_exhausted_quota_counts_pending_and_ambiguous(self):
        self.activate()
        usage = s.usage_for(self.org)
        usage.emails_sent = 4999
        usage.save()
        rid = s.reserve_send(self.org, "last")
        with self.assertRaises(ValidationError):
            s.reserve_send(self.org, "too-many")
        s.settle_send(rid, "ambiguous")
        self.assertEqual(s.summary(self.org)["usage"]["emails_remaining"], 0)
        s.settle_send(rid, "failed")
        self.assertEqual(s.summary(self.org)["usage"]["emails_remaining"], 1)

    def test_partial_import_preserves_quota(self):
        self.activate()
        usage = s.usage_for(self.org)
        usage.imports = 999
        usage.save()
        result = s.import_leads(self.org, self.user, {"idempotency_key":"last", "leads":[{"email":"a@example.com"},{"email":"b@example.com"}]})
        self.assertEqual(result["inserted"], 1)
        self.assertEqual(result["skipped"], 1)
        self.assertEqual(s.summary(self.org)["usage"]["imports"], 1000)

    def test_delivery_failure_not_retried_automatically(self):
        self.activate()
        send = patch("builtins.print")
        with send as delivery:
            delivery.side_effect = TimeoutError("uncertain")
            with self.assertRaises(TimeoutError):
                s.metered_delivery(self.org, "uncertain", delivery)
            with self.assertRaises(ValidationError):
                s.metered_delivery(self.org, "uncertain", delivery)
            self.assertEqual(delivery.call_count, 1)
        self.assertEqual(s.summary(self.org)["usage"]["emails_reserved"], 1)

    def test_refund_does_not_clear_owner_suspension(self):
        _, code = self.activate()
        self.org.status = "suspended"
        self.org.save()
        s.revoke(code.pk, self.user, "refund", "Verified")
        s.revoke(code.pk, self.user, "refund", "Corrected", reinstate=True)
        self.org.refresh_from_db()
        self.assertEqual(self.org.status, "suspended")
        self.assertFalse(s.resolve(self.org)["active"])

    def test_relay_endpoint_requires_secret_and_reports_revocation(self):
        _, code = self.activate()
        client = APIClient(enforce_csrf_checks=True)
        with override_settings(MAIL_FLOW_LEADHUNT_RELAY_SECRET="test-relay-secret"):
            self.assertEqual(client.post("/api/billing/appsumo/lead-hunter/", {"email":self.user.email}).status_code, 403)
            response = client.post("/api/billing/appsumo/lead-hunter/", {"email":self.user.email}, HTTP_X_MAIL_FLOW_SECRET="test-relay-secret")
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.data["active"])
            self.user.is_active = False
            self.user.save()
            response = client.post("/api/billing/appsumo/lead-hunter/", {"email":self.user.email}, HTTP_X_MAIL_FLOW_SECRET="test-relay-secret")
            self.assertFalse(response.data["active"])

    def test_anonymous_redemption_and_nonowner_management_denied(self):
        client = APIClient()
        self.assertIn(client.post("/api/billing/appsumo/redeem/", {"code":"x"}).status_code, [401,403])
        client.force_authenticate(self.user)
        self.assertEqual(client.get("/api/billing/platform/appsumo/").status_code, 403)

    def test_signup_atomic_rollback_and_attempt_limit(self):
        from .models import AppSumoSignupChallenge
        challenge = AppSumoSignupChallenge.objects.create(email="new@example.com", digest=s.digest("123456"), expires_at=timezone.now()+timedelta(minutes=10))
        client = APIClient()
        body = {"email":"new@example.com","name":"New", "organization_name":"New workspace", "password":"StrongPassword982!", "challenge_id":str(challenge.pk),"otp":"123456", "code":"0"*40}
        r = client.post("/api/billing/appsumo/signup/complete/", body, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertFalse(User.objects.filter(email=body["email"]).exists())
        self.assertFalse(Organization.objects.filter(name="New workspace").exists())
        body["otp"] = "000000"
        for _ in range(5):
            self.assertEqual(client.post("/api/billing/appsumo/signup/complete/", body, format="json").status_code, 400)
        challenge.refresh_from_db()
        self.assertEqual(challenge.attempts, 5)

    def test_signup_success_consumes_code_without_free_claim(self):
        from .models import AppSumoSignupChallenge, FreePlanClaim
        raw, code = self.code(9)
        challenge = AppSumoSignupChallenge.objects.create(email="new@example.com", digest=s.digest("123456"), expires_at=timezone.now()+timedelta(minutes=10))
        r = APIClient().post("/api/billing/appsumo/signup/complete/", {"email":"new@example.com","username":"newsumo","name":"New", "organization_name":"New workspace", "password":"StrongPassword982!", "challenge_id":str(challenge.pk),"otp":"123456", "code":raw}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        code.refresh_from_db()
        self.assertIsNotNone(code.organization_id)
        self.assertTrue(User.objects.filter(email="new@example.com", username="newsumo").exists())
        self.assertEqual(FreePlanClaim.objects.count(), 0)

    def test_owner_bulk_refund_preview_and_idempotent_confirmation(self):
        _, code = self.activate()
        owner = User.objects.create_user(username="owner", role="owner")
        client = APIClient()
        client.force_authenticate(owner)
        r = client.post("/api/billing/platform/appsumo/", {"action":"refund_preview", "csv":f"code,reference,reason\n{1:040X},REF1,Verified refund\n"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertNotIn(f"{1:040X}", str(r.data))
        for _ in range(2):
            result = client.post("/api/billing/platform/appsumo/", {"action":"refund_confirm", "preview_id":r.data["preview_id"]}, format="json")
            self.assertEqual(result.status_code, 200)
        self.assertEqual(s.summary(self.org)["tier"], 0)

    def test_owner_console_lists_batches_with_counts(self):
        owner = User.objects.create_user(username="owner-console", role="owner")
        batch = AppSumoBatch.objects.create(offer=self.offer, environment="test", active=True)
        AppSumoCode.objects.create(batch=batch, digest=s.digest("A"*40), encrypted_code="test-only", masked_code="****AAAAAA")
        client = APIClient()
        client.force_authenticate(owner)
        response = client.get("/api/billing/platform/appsumo/?offset=0")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn("code_count", response.data["batches"][0])

    @override_settings(APPSUMO_CODE_ADMIN_ENABLED=True)
    def test_batch_export_is_headerless_encrypted_and_audited(self):
        from .models import AppSumoAudit
        batch = s.generate_batch(self.offer, "test", self.user, count=12)
        self.assertFalse(batch.active)
        rows = s.export_batch(batch, self.user).splitlines()
        self.assertEqual(len(rows), 12)
        self.assertEqual(len(set(rows)), 12)
        self.assertTrue(all(row.startswith("AS-") and row == row.upper() for row in rows))
        self.assertTrue(all(len(s.normalize(row)) == 34 and s.normalize(row).isalnum() for row in rows))
        code = batch.codes.get(digest=s.digest(s.normalize(rows[0])))
        self.assertTrue(code.masked_code.startswith("AS-****-"))
        self.assertNotIn(rows[0], code.encrypted_code)
        self.assertNotIn(rows[0], str(list(AppSumoAudit.objects.values())))
        self.assertEqual(s.export_batch(batch, self.user).splitlines(), rows)
        with self.assertRaises(ValidationError):
            s.redeem(self.org, self.user, rows[0])
        with self.assertRaises(ValidationError):
            s.generate_batch(self.offer, "test", self.user, count=10001)

    def test_deactivating_batch_preserves_redeemed_access(self):
        self.activate()
        self.batch.active = False
        self.batch.save()
        self.assertTrue(s.resolve(self.org)["active"])
        raw, code = self.code(2)
        with self.assertRaises(ValidationError):
            s.redeem(self.org, self.user, raw)
        code.refresh_from_db()
        self.assertIsNone(code.organization_id)

    def test_activation_notification_queued_only_after_commit(self):
        with patch("billing.tasks.send_appsumo_activation_email.delay") as notify:
            with self.captureOnCommitCallbacks(execute=True):
                self.activate()
                s.redeem(self.org, self.user, f"{1:040X}")
                notify.assert_not_called()
            notify.assert_called_once_with(self.user.pk, 1)

    @override_settings(MAIL_FLOW_OTP_RELAY_URL="", MAIL_FLOW_OTP_RELAY_SECRET="")
    def test_appsumo_activation_email_uses_html_template_and_lifetime_labels(self):
        from django.core import mail
        from billing.emails import deliver_appsumo_activation_email, deliver_account_created_email
        raw, code = self.code(1)
        with patch("billing.tasks.send_appsumo_activation_email.delay"):
            s.redeem(self.org, self.user, raw)
        
        state = s.summary(self.org)
        deliver_appsumo_activation_email(self.user, 1, state)
        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertEqual(email.subject, "Your Mail Flow AppSumo lifetime access is active")
        self.assertTrue(len(email.alternatives) > 0)
        html_content = email.alternatives[0][0]
        self.assertIn("AppSumo Lifetime Access Active", html_content)
        self.assertIn("Next Quota Reset", html_content)
        self.assertNotIn("Next Billing Period", html_content)
        self.assertNotIn("T17:", email.body)  # No unformatted raw ISO timestamps

        mail.outbox.clear()
        deliver_account_created_email(self.user)
        self.assertEqual(len(mail.outbox), 1)
        email2 = mail.outbox[0]
        html_content2 = email2.alternatives[0][0]
        self.assertIn("Lifetime Access ($0 Renewal)", html_content2)
        self.assertIn("Next Quota Reset", html_content2)
        self.assertNotIn("Next Billing Period", html_content2)



@skipUnlessDBFeature("has_select_for_update")
@override_settings(APPSUMO_CODE_KEY="test-only-persistent-key-32-characters", APPSUMO_REDEMPTION_ENABLED=True, APPSUMO_ENVIRONMENT="test")
class AppSumoConcurrencyTests(TransactionTestCase):
    serialized_rollback = True

    def setUp(self):
        self.org = Organization.objects.create(name="Concurrent")
        self.user = User.objects.create_user(username="concurrent", role="admin", organization=self.org)
        self.other_org = Organization.objects.create(name="Concurrent other")
        self.other = User.objects.create_user(username="concurrent-other", role="admin", organization=self.other_org)
        batch = AppSumoBatch.objects.create(offer=AppSumoOffer.objects.get(version="2026-v1"), environment="test", active=True)
        self.raw = "F" * 40
        self.code = AppSumoCode.objects.create(batch=batch, digest=s.digest(self.raw), encrypted_code="test-only", masked_code="****FFFFFF")

    def concurrently(self, work):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier
        from django.db import close_old_connections
        gate = Barrier(2)
        def run(index):
            close_old_connections()
            try:
                gate.wait(timeout=10)
                work(index)
                return "ok"
            except ValidationError:
                return "rejected"
            finally:
                close_old_connections()
        with ThreadPoolExecutor(max_workers=2) as pool:
            return list(pool.map(run, range(2)))

    def test_two_organizations_cannot_consume_one_code(self):
        with patch("billing.tasks.send_appsumo_activation_email.delay"):
            outcomes = self.concurrently(lambda i: s.redeem(self.org if i == 0 else self.other_org, self.user if i == 0 else self.other, self.raw))
        self.assertCountEqual(outcomes, ["ok", "rejected"])
        self.assertEqual(AppSumoEntitlement.objects.count(), 1)

    def test_two_dispatches_cannot_reserve_last_send(self):
        with patch("billing.tasks.send_appsumo_activation_email.delay"):
            s.redeem(self.org, self.user, self.raw)
        usage = s.usage_for(self.org)
        usage.emails_sent = 4999
        usage.save()
        self.assertCountEqual(self.concurrently(lambda i: s.reserve_send(self.org, f"dispatch-{i}")), ["ok", "rejected"])

    def test_two_imports_cannot_take_last_import_allowance(self):
        with patch("billing.tasks.send_appsumo_activation_email.delay"):
            s.redeem(self.org, self.user, self.raw)
        usage = s.usage_for(self.org)
        usage.imports = 999
        usage.save()
        self.concurrently(lambda i: s.import_leads(self.org, self.user, {"idempotency_key": f"push-{i}", "list_name": "Concurrent", "leads": [{"email": f"person{i}@example.com"}]}))
        usage.refresh_from_db()
        self.assertEqual(usage.imports, 1000)
        self.assertEqual(self.org.recipients.count(), 1)
