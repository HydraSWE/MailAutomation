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

    @patch("support.services.imap_relay_request")
    def test_sync_same_raw_message_twice_imports_once(self, mocked_relay):
        raw = (
            "From: Customer <customer@example.test>\r\n"
            "To: support@example.test\r\n"
            "Subject: Dedupe test\r\n"
            "Message-ID: <unique-dedupe-1@example.test>\r\n"
            "\r\n"
            "First sync message body."
        ).encode()
        mocked_relay.return_value = {
            "ok": True,
            "message": "IMAP sync completed through the relay.",
            "stage": "complete",
            "messages": [{"raw": base64.b64encode(raw).decode()}],
        }

        # First sync
        res1 = self.client.post(f"/api/support/mailboxes/{self.mailbox.pk}/sync/")
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(res1.data["imported"], 1)

        # Second sync with identical message
        res2 = self.client.post(f"/api/support/mailboxes/{self.mailbox.pk}/sync/")
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.data["imported"], 0)
        self.assertEqual(SupportTicket.objects.filter(external_message_id="<unique-dedupe-1@example.test>").count(), 1)

    @patch("support.services.imap_relay_request")
    def test_sync_message_without_message_id_uses_fallback_dedupe(self, mocked_relay):
        raw = (
            "From: Customer <customer@example.test>\r\n"
            "To: support@example.test\r\n"
            "Subject: Fallback ID test\r\n"
            "Date: Sun, 23 Aug 2026 10:00:00 +0000\r\n"
            "\r\n"
            "Body without message ID header."
        ).encode()
        mocked_relay.return_value = {
            "ok": True,
            "message": "IMAP sync completed through the relay.",
            "stage": "complete",
            "messages": [{"raw": base64.b64encode(raw).decode()}],
        }

        # First sync
        res1 = self.client.post(f"/api/support/mailboxes/{self.mailbox.pk}/sync/")
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(res1.data["imported"], 1)

        ticket = SupportTicket.objects.get(subject="Fallback ID test")
        self.assertTrue(ticket.external_message_id.startswith("<fallback-"))

        # Second sync
        res2 = self.client.post(f"/api/support/mailboxes/{self.mailbox.pk}/sync/")
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.data["imported"], 0)
        self.assertEqual(SupportTicket.objects.filter(subject="Fallback ID test").count(), 1)

    @patch("support.services.send_via_mailbox")
    def test_outbound_reply_generates_message_id_and_sets_thread_headers(self, mocked_send):
        mocked_send.return_value = {"ok": True, "message": "Sent", "stage": "complete"}
        self.ticket.external_message_id = "<inbound-orig@example.test>"
        self.ticket.mailbox = self.mailbox
        self.ticket.save()

        response = self.client.post(
            f"/api/support/tickets/{self.ticket.pk}/reply/",
            {"body": "We are looking into this for you.", "mailbox": self.mailbox.pk},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        outbound_msg = SupportMessage.objects.filter(ticket=self.ticket, direction=SupportMessage.Direction.OUTBOUND).first()
        self.assertIsNotNone(outbound_msg)
        self.assertTrue(outbound_msg.external_message_id.startswith("<mf-reply-"))

        mocked_send.assert_called_once()
        _, kwargs = mocked_send.call_args
        self.assertEqual(kwargs["message_id"], outbound_msg.external_message_id)
        self.assertEqual(kwargs["in_reply_to"], "<inbound-orig@example.test>")
        self.assertEqual(kwargs["references"], "<inbound-orig@example.test>")

    @patch("support.services.imap_relay_request")
    def test_inbound_reply_with_in_reply_to_appends_to_existing_ticket(self, mocked_relay):
        self.ticket.mailbox = self.mailbox
        self.ticket.status = SupportTicket.Status.WAITING
        self.ticket.save()
        outbound_msg = SupportMessage.objects.create(
            ticket=self.ticket,
            direction=SupportMessage.Direction.OUTBOUND,
            sender_name="Support",
            sender_email=self.mailbox.email,
            recipient_email=self.ticket.email,
            subject="Re: Need help",
            body="Here is your answer.",
            external_message_id="<outbound-reply-123@example.test>",
        )

        raw_reply = (
            "From: Customer <customer@example.test>\r\n"
            "To: support@example.test\r\n"
            "Subject: Re: Need help\r\n"
            "Message-ID: <customer-reply-456@example.test>\r\n"
            f"In-Reply-To: {outbound_msg.external_message_id}\r\n"
            f"References: {outbound_msg.external_message_id}\r\n"
            "\r\n"
            "Thank you, that solved it!\r\n\r\n"
            f"On Sun, Aug 23, 2026 at 10:00 AM Support <{self.mailbox.email}> wrote:\r\n"
            "> Here is your answer."
        ).encode()

        mocked_relay.return_value = {
            "ok": True,
            "message": "IMAP sync completed through the relay.",
            "stage": "complete",
            "messages": [{"raw": base64.b64encode(raw_reply).decode()}],
        }

        response = self.client.post(f"/api/support/mailboxes/{self.mailbox.pk}/sync/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["imported"], 1)

        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, SupportTicket.Status.OPEN)
        self.assertEqual(self.ticket.messages.count(), 2)

        new_inbound = self.ticket.messages.filter(external_message_id="<customer-reply-456@example.test>").first()
        self.assertIsNotNone(new_inbound)
        self.assertEqual(new_inbound.body, "Thank you, that solved it!")

    @patch("support.services.imap_relay_request")
    def test_inbound_reply_with_references_appends_to_existing_ticket(self, mocked_relay):
        self.ticket.mailbox = self.mailbox
        self.ticket.external_message_id = "<root-msg-id@example.test>"
        self.ticket.save()

        raw_reply = (
            "From: Customer <customer@example.test>\r\n"
            "To: support@example.test\r\n"
            "Subject: Re: Need help\r\n"
            "Message-ID: <reply-ref-only@example.test>\r\n"
            "References: <root-msg-id@example.test>\r\n"
            "\r\n"
            "Follow-up details here.\r\n"
            "-----Original Message-----\r\n"
            "From: Support\r\n"
            "Sent: Sunday, August 23, 2026\r\n"
            "To: Customer\r\n"
            "Subject: Need help"
        ).encode()

        mocked_relay.return_value = {
            "ok": True,
            "message": "IMAP sync completed through the relay.",
            "stage": "complete",
            "messages": [{"raw": base64.b64encode(raw_reply).decode()}],
        }

        response = self.client.post(f"/api/support/mailboxes/{self.mailbox.pk}/sync/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["imported"], 1)

        self.ticket.refresh_from_db()
        new_inbound = self.ticket.messages.filter(external_message_id="<reply-ref-only@example.test>").first()
        self.assertIsNotNone(new_inbound)
        self.assertEqual(new_inbound.body, "Follow-up details here.")

    @patch("support.services.imap_relay_request")
    def test_inbound_reply_without_headers_matches_subject_and_sender(self, mocked_relay):
        self.ticket.mailbox = self.mailbox
        self.ticket.subject = "Login Issue"
        self.ticket.email = "customer@example.test"
        self.ticket.save()

        raw_reply = (
            "From: Customer <customer@example.test>\r\n"
            "To: support@example.test\r\n"
            "Subject: Re: Login Issue\r\n"
            "Message-ID: <no-ref-reply@example.test>\r\n"
            "\r\n"
            "I still cannot login."
        ).encode()

        mocked_relay.return_value = {
            "ok": True,
            "message": "IMAP sync completed through the relay.",
            "stage": "complete",
            "messages": [{"raw": base64.b64encode(raw_reply).decode()}],
        }

        response = self.client.post(f"/api/support/mailboxes/{self.mailbox.pk}/sync/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["imported"], 1)

        self.assertEqual(SupportTicket.objects.filter(subject="Login Issue").count(), 1)
        self.ticket.refresh_from_db()
        self.assertTrue(self.ticket.messages.filter(external_message_id="<no-ref-reply@example.test>").exists())

    @patch("support.services.imap_relay_request")
    def test_genuinely_new_ticket_created_for_different_subject(self, mocked_relay):
        self.ticket.mailbox = self.mailbox
        self.ticket.subject = "Old Issue"
        self.ticket.email = "customer@example.test"
        self.ticket.save()

        raw_new = (
            "From: Customer <customer@example.test>\r\n"
            "To: support@example.test\r\n"
            "Subject: Completely Brand New Topic\r\n"
            "Message-ID: <brand-new-msg@example.test>\r\n"
            "\r\n"
            "This is an entirely different issue."
        ).encode()

        mocked_relay.return_value = {
            "ok": True,
            "message": "IMAP sync completed through the relay.",
            "stage": "complete",
            "messages": [{"raw": base64.b64encode(raw_new).decode()}],
        }

        response = self.client.post(f"/api/support/mailboxes/{self.mailbox.pk}/sync/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["imported"], 1)

        self.assertEqual(SupportTicket.objects.count(), 2)
        new_ticket = SupportTicket.objects.get(external_message_id="<brand-new-msg@example.test>")
        self.assertEqual(new_ticket.subject, "Completely Brand New Topic")

    @patch("support.services.imap_relay_request")
    def test_quote_stripping_fallback_when_entire_body_is_quoted(self, mocked_relay):
        raw_quoted = (
            "From: Customer <customer@example.test>\r\n"
            "To: support@example.test\r\n"
            "Subject: Only Quote\r\n"
            "Message-ID: <quote-only@example.test>\r\n"
            "\r\n"
            "> Just this quoted line and nothing else."
        ).encode()

        mocked_relay.return_value = {
            "ok": True,
            "message": "IMAP sync completed through the relay.",
            "stage": "complete",
            "messages": [{"raw": base64.b64encode(raw_quoted).decode()}],
        }

        response = self.client.post(f"/api/support/mailboxes/{self.mailbox.pk}/sync/")
        self.assertEqual(response.status_code, 200)
        ticket = SupportTicket.objects.get(external_message_id="<quote-only@example.test>")
        msg = ticket.messages.first()
        self.assertIsNotNone(msg)
        self.assertEqual(msg.body, "> Just this quoted line and nothing else.")

