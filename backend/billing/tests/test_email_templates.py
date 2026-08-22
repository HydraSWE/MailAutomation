from pathlib import Path
from tempfile import TemporaryDirectory

from django.core.management import call_command
from django.test import SimpleTestCase

from billing.emails import build_html_shell


class BillingEmailTemplateTests(SimpleTestCase):
    def test_shell_renders_named_template_and_escapes_dynamic_values(self):
        rendered = build_html_shell(
            "Invoice <ready>",
            "Hello <customer>",
            [("Account", "user<script>@example.com"), ("Status", "Confirmed")],
            "https://example.com/invoice?a=1&b=2",
            "Open invoice",
            badge="Invoice Ready",
            template_name="emails/billing/invoice_created.html",
        )

        self.assertIn("Invoice &lt;ready&gt;", rendered)
        self.assertIn("user&lt;script&gt;@example.com", rendered)
        self.assertIn("Invoice Ready", rendered)
        self.assertIn("https://example.com/invoice?a=1&amp;b=2", rendered)
        self.assertNotIn("user<script>", rendered)

    def test_trusted_custom_content_is_embedded(self):
        rendered = build_html_shell(
            "Verification Code",
            "Use this code",
            custom_content='<div data-testid="otp">123456</div>',
            template_name="emails/billing/checkout_otp.html",
        )
        self.assertIn('<div data-testid="otp">123456</div>', rendered)

    def test_preview_command_uses_production_templates(self):
        with TemporaryDirectory() as output:
            call_command("generate_email_previews", output=Path(output), verbosity=0)
            previews = sorted((Path(output) / "email_previews").glob("*.html"))
            self.assertEqual(len(previews), 8)
            self.assertTrue((Path(output) / "email_templates_gallery.html").exists())
            self.assertIn("Payment Confirmed", previews[3].read_text(encoding="utf-8"))
