from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase


class BillingModuleCompatibilityTests(SimpleTestCase):
    def test_service_facade_preserves_public_functions(self):
        from billing import services

        for name in (
            "create_invoice", "create_custom_invoice", "replace_invoice",
            "cancel_invoice", "fulfill_paid_invoice", "assign_plan_to_organization",
            "start_checkout_email_verification", "verify_checkout_email",
        ):
            self.assertTrue(callable(getattr(services, name)))
            self.assertNotIn("legacy", getattr(services, name).__module__)

    def test_view_facade_preserves_url_imports(self):
        from billing import views

        for name in (
            "PlanListView", "FreeSignupView", "InvoiceCreateView",
            "InvoiceVerifyView", "PaymentReviewViewSet",
        ):
            self.assertTrue(hasattr(views, name))
            self.assertNotIn("legacy", getattr(views, name).__module__)

    def test_pure_pricing_service_remains_callable_after_split(self):
        from billing.services import custom_pricing_preview

        premium = SimpleNamespace(
            slug="premium-plus", email_limit=100_000, max_admins=5,
            max_users=25, max_smtp_accounts=5, max_recipients=50_000,
            original_price_bdt=5_000, price_bdt=4_000, discount_percent=20,
            max_campaigns_per_day=100,
        )
        custom = SimpleNamespace(slug="custom", discount_percent=10, max_campaigns_per_day=0)
        with patch("billing.services.invoices.Plan.objects.get", side_effect=[premium, custom]):
            plan, price, snapshot = custom_pricing_preview({
                "email_limit": 100_000, "max_admins": 5, "max_users": 25,
                "max_smtp_accounts": 5, "max_recipients": 50_000,
            })
        self.assertIs(plan, custom)
        self.assertEqual(price, 4_500)
        self.assertTrue(snapshot["custom_plan"])
