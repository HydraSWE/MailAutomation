from unittest.mock import patch
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from billing.models import CheckoutEmailVerification, PreCheckoutSession
from billing.services import start_checkout_email_verification, verify_checkout_email


class CheckoutVerificationServiceTests(TestCase):
    @patch("billing.services.checkout.audit_event")
    @patch("billing.services.checkout.verify_turnstile")
    def test_start_normalizes_email_and_records_challenge(self, turnstile, _audit):
        turnstile.return_value = None
        start_checkout_email_verification(" USER@Example.COM ", "token")
        verification = CheckoutEmailVerification.objects.get()
        self.assertEqual(verification.normalized_email, "user@example.com")
        self.assertEqual(verification.email, "user@example.com")

    @patch("billing.services.checkout.audit_event")
    def test_verify_issues_single_use_precheckout_session(self, _audit):
        from billing.services.common import private_hash

        CheckoutEmailVerification.objects.create(
            normalized_email="user@example.com", email="user@example.com",
            code_digest=private_hash("123456"), expires_at=timezone.now() + timedelta(minutes=5),
        )
        token = verify_checkout_email("USER@example.com", "123456")
        session = PreCheckoutSession.objects.get()
        self.assertEqual(session.normalized_email, "user@example.com")
        self.assertTrue(token)

    def test_expired_code_is_rejected(self):
        from billing.services.common import private_hash
        from rest_framework.exceptions import ValidationError

        CheckoutEmailVerification.objects.create(
            normalized_email="user@example.com", email="user@example.com",
            code_digest=private_hash("123456"), expires_at=timezone.now() - timedelta(seconds=1),
        )
        with self.assertRaises(ValidationError):
            verify_checkout_email("user@example.com", "123456")
