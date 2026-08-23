import base64
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from users.models import User
from .models import SupportMailbox, SupportMessage, SupportTicket


class SupportWorkspaceReplyTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="platform-owner",
            email="owner@example.test",
            password="ValidPass123!",
            role=User.Role.OWNER,
        )
        self.mailbox = SupportMailbox.objects.create(
            organization=None,
            name="Support",
            email="support@example.test",
            imap_host="mail.example.test",
            imap_port=993,
            imap_username="support@example.test",
            smtp_host="mail.example.test",
            smtp_port=465,
            smtp_username="support@example.test",
        )
        self.mailbox.set_imap_password("secret-pass")
        self.mailbox.set_smtp_password("secret-pass")
        self.mailbox.save()
        self.ticket = SupportTicket.objects.create(
            ticket_number="MF-260823-0001",
            name="Customer",
            email="customer@example.test",
            subject="Need help",
            source="public",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    @patch("support.views.send_support_reply")
    def test_reply_returns_clear_mailbox_send_error(self, mocked_send):
        mocked_send.side_effect = RuntimeError("Mailbox SMTP relay request failed.")

        response = self.client.post(
            f"/api/support/tickets/{self.ticket.pk}/reply/",
            {"body": "Hello", "mailbox": self.mailbox.pk},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["detail"], "Mailbox SMTP relay request failed.")

    @patch("support.views.send_via_mailbox")
    def test_mailbox_smtp_test_uses_mailbox_sender(self, mocked_send):
        mocked_send.return_value = {"ok": True, "message": "SMTP test email sent.", "stage": "complete"}

        response = self.client.post(
            f"/api/support/mailboxes/{self.mailbox.pk}/test-smtp/",
            {"recipient_email": "customer@example.test"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["message"], "SMTP test email sent.")
        mocked_send.assert_called_once()

    @patch("support.views.sync_mailbox")
    def test_mailbox_sync_returns_clear_imap_auth_error(self, mocked_sync):
        mocked_sync.side_effect = RuntimeError("IMAP connection failed. Authentication failed.")

        response = self.client.post(f"/api/support/mailboxes/{self.mailbox.pk}/sync/")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["detail"], "IMAP connection failed. Authentication failed.")

    @patch("support.services.imap_relay_request")
    def test_mailbox_sync_imports_raw_messages_from_php_relay(self, mocked_relay):
        raw = (
            "From: Customer <customer@example.test>\r\n"
            "To: support@example.test\r\n"
            "Subject: Need help from relay\r\n"
            "Message-ID: <relay-1@example.test>\r\n"
            "\r\n"
            "Hello from the PHP IMAP relay."
        ).encode()
        mocked_relay.return_value = {
            "ok": True,
            "message": "IMAP sync completed through the relay.",
            "stage": "complete",
            "messages": [{"raw": base64.b64encode(raw).decode()}],
        }

        response = self.client.post(f"/api/support/mailboxes/{self.mailbox.pk}/sync/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["imported"], 1)
        ticket = SupportTicket.objects.get(external_message_id="<relay-1@example.test>")
        self.assertEqual(ticket.mailbox, self.mailbox)
        self.assertTrue(SupportMessage.objects.filter(ticket=ticket, body="Hello from the PHP IMAP relay.").exists())

    @patch("support.views.test_imap_via_relay")
    def test_mailbox_imap_test_uses_php_relay(self, mocked_test):
        mocked_test.return_value = {"ok": True, "message": "IMAP connection successful through the relay.", "stage": "complete", "messages": []}

        response = self.client.post(f"/api/support/mailboxes/{self.mailbox.pk}/test-imap/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["message"], "IMAP connection successful through the relay.")

    def test_owner_creates_platform_support_inbox(self):
        response = self.client.post(
            "/api/support/mailboxes/",
            {
                "name": "Platform Support",
                "email": "support@example.test",
                "imap_host": "mail.example.test",
                "imap_port": 993,
                "imap_encryption": "ssl",
                "imap_username": "support@example.test",
                "imap_password": "secret-pass",
                "smtp_host": "mail.example.test",
                "smtp_port": 465,
                "smtp_encryption": "ssl",
                "smtp_username": "support@example.test",
                "smtp_password": "secret-pass",
                "from_name": "Support",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertIsNone(SupportMailbox.objects.get(pk=response.data["id"]).organization)
