from uuid import uuid4

from django.urls import reverse
from rest_framework.test import APIClient
from django.test import TestCase

from common.models import Organization
from users.models import User, UserLoginSession


class UserWorkflowTests(TestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name="Workflow Org", max_admins=3)
        self.admin = User.objects.create_user(username="admin", email="admin@example.com", password="ValidPass123!", role=User.Role.ADMIN, organization=self.organization)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_cannot_delete_self_or_last_active_admin(self):
        response = self.client.delete(f"/api/users/{self.admin.pk}/")
        self.assertEqual(response.status_code, 400)

        other = User.objects.create_user(username="operator", email="operator@example.com", password="ValidPass123!", role=User.Role.OPERATOR, organization=self.organization)
        response = self.client.patch(f"/api/users/{self.admin.pk}/", {"role": "manager"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertTrue(User.objects.filter(pk=other.pk).exists())

    def test_password_reset_revokes_target_sessions(self):
        target = User.objects.create_user(username="target", email="target@example.com", password="ValidPass123!", organization=self.organization)
        session = UserLoginSession.objects.create(user=target, session_id=uuid4())
        response = self.client.post(f"/api/users/{target.pk}/set-password/", {"password": "NewValidPass456!"}, format="json")
        self.assertEqual(response.status_code, 200)
        session.refresh_from_db()
        self.assertIsNotNone(session.revoked_at)

    def test_session_revoke_is_tenant_scoped(self):
        target = User.objects.create_user(username="member", email="member@example.com", password="ValidPass123!", organization=self.organization)
        session = UserLoginSession.objects.create(user=target, session_id=uuid4())
        response = self.client.post(f"/api/sessions/{session.pk}/revoke/")
        self.assertEqual(response.status_code, 200)
        session.refresh_from_db()
        self.assertIsNotNone(session.revoked_at)

    def test_new_login_revokes_previous_sessions_for_admin(self):
        previous = UserLoginSession.objects.create(user=self.admin, session_id=uuid4())
        client = APIClient()

        response = client.post(
            "/api/auth/token/",
            {"username": self.admin.username, "password": "ValidPass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        previous.refresh_from_db()
        self.assertIsNotNone(previous.revoked_at)
        self.assertEqual(UserLoginSession.objects.filter(user=self.admin, revoked_at__isnull=True).count(), 1)

    def test_2fa_disable_rejects_incorrect_password(self):
        self.admin.two_factor_enabled = True
        self.admin.two_factor_secret = "secret"
        self.admin.save(update_fields=["two_factor_enabled", "two_factor_secret"])
        response = self.client.post("/api/auth/2fa/disable/", {"password": "wrong"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.two_factor_enabled)
