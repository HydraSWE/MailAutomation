import socket
from django.test import TestCase
from rest_framework.test import APIClient
from unittest.mock import patch

from common.models import Organization
from users.models import User
from .models import SMTPAccount


class SMTPPlatformOwnerTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="platform-owner",
            email="owner@example.test",
            password="ValidPass123!",
            role=User.Role.OWNER,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    @patch("common.validators.socket.getaddrinfo")
    def test_owner_creates_platform_smtp_account(self, mocked_getaddrinfo):
        mocked_getaddrinfo.return_value = [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 0))]
        response = self.client.post(
            "/api/smtp-accounts/",
            {
                "name": "Platform SMTP",
                "host": "smtp.example.test",
                "port": 587,
                "username": "platform@example.test",
                "password": "secret-pass",
                "encryption": "tls",
                "from_email": "platform@example.test",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        account = SMTPAccount.objects.get()
        self.assertIsNone(account.organization)

    def test_rejects_localhost_smtp_target(self):
        response = self.client.post(
            "/api/smtp-accounts/",
            {
                "name": "Local SMTP",
                "host": "localhost",
                "port": 587,
                "username": "platform@example.test",
                "password": "secret-pass",
                "encryption": "tls",
                "from_email": "platform@example.test",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("host", response.data)

    def test_owner_only_sees_platform_smtp_accounts(self):
        organization = Organization.objects.create(name="Tenant")
        SMTPAccount.objects.create(
            organization=None,
            name="Platform SMTP",
            host="smtp.example.test",
            port=587,
            username="platform@example.test",
            encrypted_password="",
            from_email="platform@example.test",
        )
        SMTPAccount.objects.create(
            organization=organization,
            name="Tenant SMTP",
            host="smtp.example.test",
            port=587,
            username="tenant@example.test",
            encrypted_password="",
            from_email="tenant@example.test",
        )

        response = self.client.get("/api/smtp-accounts/")

        self.assertEqual(response.status_code, 200)
        results = response.data.get("results", response.data)
        self.assertEqual([item["name"] for item in results], ["Platform SMTP"])

    @patch("smtp_manager.views.send_test_mail")
    def test_owner_can_send_platform_smtp_test_without_org_quota(self, mocked_send):
        account = SMTPAccount.objects.create(
            organization=None,
            name="Platform SMTP",
            host="smtp.example.test",
            port=587,
            username="platform@example.test",
            encrypted_password="",
            from_email="platform@example.test",
            daily_limit=10,
        )
        mocked_send.return_value = {"ok": True, "message": "Accepted", "stage": "complete"}

        response = self.client.post(
            f"/api/smtp-accounts/{account.pk}/send-test/",
            {"recipient_email": "platform@example.test"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        account.refresh_from_db()
        self.assertEqual(account.sent_today, 1)
