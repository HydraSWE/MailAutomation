import hashlib
import hmac
import json
import os
import time
from typing import Any, Iterable, Optional, TypedDict
from urllib.parse import urljoin

import requests
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.html import escape
from django.utils.safestring import mark_safe

from .models import PaymentInvoice, Subscription

LOGO_URL = os.environ.get("LOGO_URL")
MARK_URL = os.environ.get("MARK_URL")


class EmailRowContext(TypedDict):
    label: str
    value: str
    dark: bool
    last: bool
    accent: bool


class EmailShellContext(TypedDict):
    title: str
    intro: str
    rows: list[EmailRowContext]
    cta_url: str
    cta_label: str
    custom_content: str
    badge: str
    footer_note: str
    logo_url: Optional[str]
    mark_url: Optional[str]

def send_system_email(
    subject: str,
    body: str,
    recipient: str,
    html: Optional[str] = None,
    *,
    sender: str = "billing",
) -> None:
    """
    Sends a transactional system email via the Mail Flow OTP relay (if configured)
    or falls back to Django's standard SMTP email backend.
    """
    relay_url = getattr(settings, "MAIL_FLOW_OTP_RELAY_URL", "")
    relay_secret = getattr(settings, "MAIL_FLOW_OTP_RELAY_SECRET", "")
    sender_type = sender if sender in {"billing", "general"} else "billing"

    if relay_url and relay_secret:
        timestamp = str(int(time.time()))
        payload: dict[str, Any] = {
            "email": recipient,
            "sender": sender_type,
            "subject": subject,
            "body": body,
            "timestamp": timestamp,
        }
        if html:
            payload["html"] = html
        signed_payload = json.dumps(payload, separators=(",", ":"), sort_keys=True)
        signature = hmac.new(
            relay_secret.encode(), signed_payload.encode(), hashlib.sha256
        ).hexdigest()
        response = requests.post(
            relay_url,
            json=payload,
            headers={
                "X-Mail-Flow-Signature": signature,
                "X-Mail-Flow-Timestamp": timestamp,
            },
            timeout=getattr(settings, "MAIL_FLOW_OTP_RELAY_TIMEOUT", 10),
        )
        response.raise_for_status()
        return

    reply_to = [settings.MAIL_FLOW_REPLY_TO] if settings.MAIL_FLOW_REPLY_TO else None
    from_email = settings.DEFAULT_FROM_EMAIL
    if sender_type == "general":
        from_email = (
            f"{settings.MAIL_FLOW_GENERAL_SENDER_NAME} <{settings.MAIL_FLOW_GENERAL_SENDER_EMAIL}>"
        )

    message = EmailMultiAlternatives(
        subject=subject,
        body=body,
        from_email=from_email,
        to=[recipient],
        reply_to=reply_to,
    )
    if html:
        message.attach_alternative(html, "text/html")
    message.send(fail_silently=False)


def format_datetime(value) -> str:
    if not value:
        return "Not available"
    return timezone.localtime(value).strftime("%d %b %Y, %I:%M %p %Z")


def format_limit(value) -> str:
    return f"{int(value):,}" if value else "Not included"


def limit_value(source: Any, key: str) -> int:
    return source.get(key, 0) if isinstance(source, dict) else getattr(source, key, 0)


def limits_text(source: Any) -> str:
    return (
        f"Included email quota: {format_limit(limit_value(source, 'email_limit'))} per billing period\n"
        f"Daily email limit: {format_limit(limit_value(source, 'daily_email_limit'))}\n"
        f"Weekly email limit: {format_limit(limit_value(source, 'weekly_email_limit'))}\n"
        f"Administrators: {format_limit(limit_value(source, 'max_admins'))}\n"
        f"Users: {format_limit(limit_value(source, 'max_users'))}\n"
        f"SMTP accounts: {format_limit(limit_value(source, 'max_smtp_accounts'))}"
    )


def invoice_link(invoice: PaymentInvoice) -> str:
    from .models import InvoiceAccessCode
    from .services import (
        decrypt_invoice_access_code,
        invoice_resume_url,
        issue_invoice_access_code,
    )

    if invoice.status not in (
        PaymentInvoice.Status.PENDING,
        PaymentInvoice.Status.VERIFYING,
        PaymentInvoice.Status.EXPIRED,
    ):
        return invoice_resume_url(invoice)

    token = issue_invoice_access_code(invoice, revoke_existing=False)
    access_code = (
        InvoiceAccessCode.objects.filter(invoice=invoice)
        .order_by("-created_at")
        .first()
    )
    token = decrypt_invoice_access_code(access_code) or token
    return invoice_resume_url(invoice, token)


def build_html_shell(
    title: str,
    intro: str,
    rows: Optional[Iterable[tuple[str, Any]]] = None,
    cta_url: str = "",
    cta_label: str = "",
    *,
    custom_content: str = "",
    badge: str = "",
    footer_note: str = "",
    template_name: str = "emails/billing/base.html",
) -> str:
    """
    Constructs a responsive, branded HTML email template featuring the official
    Mail Flow logo and brand identity (Deep Obsidian canvas, Slate 900 card,
    Electric Cyan highlights, and Royal Blue CTAs).
    """
    rows_list = list(rows or [])
    rendered_rows: list[EmailRowContext] = []
    for index, (label, value) in enumerate(rows_list):
        value_text = str(value)
        rendered_rows.append({
            "label": str(label),
            "value": value_text,
            "dark": index % 2 == 0,
            "last": index == len(rows_list) - 1,
            "accent": any(token in value_text for token in ("USDT", "BNB", "TRX", "TON", "ETH", "GRAM", "http", "Active", "Confirmed")),
        })
    context: EmailShellContext = {
        "title": title,
        "intro": intro,
        "rows": rendered_rows,
        "cta_url": cta_url,
        "cta_label": cta_label,
        "custom_content": mark_safe(custom_content),
        "badge": badge,
        "footer_note": footer_note or "This is an automated system notification from Mail Flow. Please do not reply directly to this email.",
        "logo_url": LOGO_URL,
        "mark_url": MARK_URL,
    }
    return render_to_string(template_name, context)


def _invoice_crypto_data(invoice: PaymentInvoice) -> tuple[str, str, str]:
    """Returns (symbol, formatted_amount_with_symbol, raw_amount_str)"""
    is_native = getattr(invoice, "payment_asset", PaymentInvoice.PaymentAsset.USDT) == PaymentInvoice.PaymentAsset.NATIVE
    symbol = getattr(invoice, "crypto_symbol", "") or ("BNB" if is_native else "USDT")
    if is_native:
        amount_val = getattr(invoice, "crypto_amount", None)
        if amount_val is None:
            amount_val = Decimal("0")
        amount_str = f"{amount_val} {symbol}"
        raw_amount = str(amount_val)
    else:
        amount_val = getattr(invoice, "amount_usdt", None)
        if amount_val is None:
            amount_val = Decimal("0")
        amount_str = f"{amount_val} USDT"
        raw_amount = str(amount_val)
    return symbol, amount_str, raw_amount



# ---------------------------------------------------------------------------
# Individual Email Deliveries
# ---------------------------------------------------------------------------

def deliver_checkout_otp_email(email: str, code: str) -> None:
    subject = "Verify your Mail Flow checkout"
    body = (
        f"Your Mail Flow checkout verification code is: {code}\n\n"
        "This code will expire in 10 minutes.\n"
        "If you did not initiate this request, you can safely ignore this email."
    )
    custom_content = (
        "<div style=\"background-color:#0B0F17;border:1px solid #1E293B;border-radius:10px;padding:22px;text-align:center;margin:20px 0;box-shadow:inset 0 2px 4px rgba(0,0,0,0.4);\">"
        "<div style=\"font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;\">Verification Code</div>"
        f"<div style=\"font-size:34px;font-weight:800;letter-spacing:8px;color:#38BDF8;font-family:monospace;text-shadow:0 0 16px rgba(56,189,248,0.25);\">{escape(code)}</div>"
        "<div style=\"font-size:12px;color:#64748B;margin-top:8px;\">Expires in 10 minutes</div>"
        "</div>"
    )
    html = build_html_shell(
        "Verification Code",
        "Please use the verification code below to complete your checkout on Mail Flow.",
        rows=None,
        custom_content=custom_content,
        badge="Security Verification",
        footer_note="Never share your verification code with anyone. Mail Flow staff will never ask for this code.",
        template_name="emails/billing/checkout_otp.html",
    )
    send_system_email(subject, body, email, html, sender="billing")


def deliver_email_change_otp(email: str, code: str) -> None:
    subject = "Verify your new Mail Flow email address"
    body = (
        f"Your verification code to update your Mail Flow account email is: {code}\n\n"
        "This code will expire in 10 minutes.\n"
        "If you did not initiate this change, please ensure your account password is secure."
    )
    custom_content = (
        "<div style=\"background-color:#0B0F17;border:1px solid #1E293B;border-radius:10px;padding:22px;text-align:center;margin:20px 0;box-shadow:inset 0 2px 4px rgba(0,0,0,0.4);\">"
        "<div style=\"font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;\">Email Verification Code</div>"
        f"<div style=\"font-size:34px;font-weight:800;letter-spacing:8px;color:#38BDF8;font-family:monospace;text-shadow:0 0 16px rgba(56,189,248,0.25);\">{escape(code)}</div>"
        "<div style=\"font-size:12px;color:#64748B;margin-top:8px;\">Expires in 10 minutes</div>"
        "</div>"
    )
    html = build_html_shell(
        "Email Change Verification",
        "Please use the verification code below to confirm updating your account email on Mail Flow.",
        rows=None,
        custom_content=custom_content,
        badge="Security Verification",
        footer_note="Never share your verification code with anyone. Mail Flow staff will never ask for this code.",
        template_name="emails/billing/checkout_otp.html",
    )
    send_system_email(subject, body, email, html, sender="billing")



def deliver_invoice_email(invoice: PaymentInvoice, *, recovery: bool = False) -> None:
    link = invoice_link(invoice)
    symbol, amount_str, _ = _invoice_crypto_data(invoice)
    purpose = f"Resume your {symbol} payment" if recovery else f"Your {symbol} invoice is ready"
    network_label = dict(PaymentInvoice.Network.choices).get(invoice.network, invoice.network)
    rows = [
        ("Invoice ID", invoice.pk),
        ("Account", invoice.customer_email),
        ("Organization", invoice.organization_name),
        ("Plan", invoice.plan.name),
        ("Plan price", f"BDT {invoice.price_bdt:,}"),
        (f"{symbol} quote", amount_str),
        ("Network", network_label),
        ("Receiving address", invoice.receiving_address),
        ("Quote expires", format_datetime(invoice.expires_at)),
    ]
    limits = limits_text(
        invoice.snapshot_limits
        if invoice.snapshot_limits.get("custom_plan")
        else invoice.plan
    )
    body = (
        f"Hello {invoice.customer_name},\n\n"
        f"{purpose} for Mail Flow.\n\n"
        f"Invoice ID: {invoice.pk}\n"
        f"Organization: {invoice.organization_name}\n"
        f"Plan: {invoice.plan.name}\n"
        f"Plan price: BDT {invoice.price_bdt:,}\n"
        f"Amount: {amount_str}\n"
        f"Network: {network_label}\n"
        f"Receiving address: {invoice.receiving_address}\n"
        f"Quote expires: {format_datetime(invoice.expires_at)}\n\n"
        f"{limits}\n\n"
        f"Secure payment link: {link}\n\n"
        "This billing link grants access to your invoice. Do not forward it."
    )

    custom_content = ""
    if recovery:
        custom_content = (
            "<table role=\"presentation\" width=\"100%\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#0B0F17;border:1px solid rgba(245,158,11,0.3);border-radius:10px;margin:16px 0 20px;\">"
            "<tr>"
            "<td style=\"padding:14px 16px;\">"
            "<table role=\"presentation\" width=\"100%\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\">"
            "<tr>"
            "<td style=\"width:28px;vertical-align:top;font-size:18px;line-height:1;\">⏳</td>"
            "<td style=\"vertical-align:top;padding-left:8px;\">"
            "<div style=\"font-size:13px;font-weight:700;color:#FBBF24;letter-spacing:0.01em;\">Payment Pending Confirmation</div>"
            f"<div style=\"font-size:12px;color:#94A3B8;margin-top:3px;line-height:1.4;\">Your {symbol} quote is still active. Use the button below to resume and complete your transaction directly on the blockchain.</div>"
            "</td>"
            "</tr>"
            "</table>"
            "</td>"
            "</tr>"
            "</table>"
        )
        intro_text = f"Hello {invoice.customer_name}, we noticed your {symbol} payment is still pending. You can resume and complete your payment below before the quote expires."
        cta_label = f"Resume {symbol} Payment"
        badge_label = "Payment Pending"
        footer_note = "This secure payment recovery link grants direct access to complete your invoice. Do not forward this email."
    else:
        intro_text = f"Hello {invoice.customer_name}, your Mail Flow billing invoice is ready with the details below."
        cta_label = "Open Secure Invoice"
        badge_label = "Invoice Ready"
        footer_note = "This secure billing link grants access to your invoice. Do not forward this email."

    html = build_html_shell(
        purpose,
        intro_text,
        rows,
        link,
        cta_label,
        custom_content=custom_content,
        badge=badge_label,
        footer_note=footer_note,
        template_name="emails/billing/invoice_recovery.html" if recovery else "emails/billing/invoice_created.html",
    )
    send_system_email(f"{purpose} - Mail Flow", body, invoice.customer_email, html, sender="billing")
    invoice.access_codes.filter(encrypted_delivery_copy__gt="").update(
        encrypted_delivery_copy=""
    )


def deliver_payment_confirmation_email(invoice: PaymentInvoice) -> None:
    subscription = Subscription.objects.filter(organization=invoice.organization).first()
    explorer = {
        "bsc": "https://bscscan.com/tx/",
        "ethereum": "https://etherscan.io/tx/",
        "tron": "https://tronscan.org/#/transaction/",
        "ton": "https://tonviewer.com/transaction/",
    }.get(invoice.network, "")
    network_labels: dict[str, str] = {
        str(value): str(label) for value, label in PaymentInvoice.Network.choices
    }
    network_label = network_labels.get(str(invoice.network), str(invoice.network))
    period_end_str = (
        format_datetime(subscription.current_period_end)
        if subscription
        else "See your dashboard"
    )
    login_url = f"{settings.FRONTEND_URL.rstrip('/')}/login"
    symbol, amount_str, _ = _invoice_crypto_data(invoice)

    body = (
        f"Hello {invoice.customer_name},\n\nPayment confirmed. Your {invoice.plan.name} plan is active.\n"
        f"Amount: {amount_str}\nNetwork: {network_label}\n"
        f"Transaction: {explorer}{invoice.transaction_hash}\n"
        f"Next billing period starts after: {period_end_str}\n\n"
        f"Sign in: {login_url}"
    )
    rows = [
        ("Organization", invoice.organization_name),
        ("Plan", invoice.plan.name),
        ("Amount", amount_str),
        ("Network", network_label),
        ("Transaction", f"{explorer}{invoice.transaction_hash}" if invoice.transaction_hash else "Confirmed"),
        ("Next billing date", period_end_str),
    ]
    html = build_html_shell(
        "Payment Confirmed",
        f"Hello {invoice.customer_name}, your Mail Flow payment has been successfully confirmed.",
        rows,
        login_url,
        "Access Your Dashboard",
        badge="Payment Verified",
        footer_note="Your subscription plan has been activated. Thank you for using Mail Flow.",
        template_name="emails/billing/payment_confirmation.html",
    )
    send_system_email("Payment confirmed - Mail Flow", body, invoice.customer_email, html, sender="billing")


def deliver_manual_review_email(invoice: PaymentInvoice) -> None:
    symbol, amount_str, _ = _invoice_crypto_data(invoice)
    body = (
        f"Hello {invoice.customer_name},\n\nWe found your {symbol} transfer, but it arrived after the quote expired. "
        "The payment has been placed in manual review. We will contact you after it is resolved.\n\n"
        f"Invoice: {invoice.pk}\nTransaction: {invoice.transaction_hash or 'Recorded'}"
    )
    rows = [
        ("Invoice ID", invoice.pk),
        ("Organization", invoice.organization_name),
        ("Plan", invoice.plan.name),
        ("Amount", amount_str),
        ("Transaction Hash", invoice.transaction_hash or "Recorded"),
        ("Status", "Under Manual Review"),
    ]
    html = build_html_shell(
        "Payment Under Review",
        f"Hello {invoice.customer_name}, your {symbol} transfer arrived after the invoice expired and has been queued for manual review.",
        rows,
        badge="Manual Review",
        footer_note="Our billing team is reviewing your transfer and will update your account shortly.",
        template_name="emails/billing/manual_review.html",
    )
    send_system_email("Payment under manual review - Mail Flow", body, invoice.customer_email, html, sender="billing")


def deliver_account_created_email(user: Any) -> None:
    organization = user.organization
    if not organization:
        return
    subscription = getattr(organization, "subscription", None)
    plan = subscription.plan if subscription else None
    login_url = f"{settings.FRONTEND_URL.rstrip('/')}/login"
    period_start = (
        format_datetime(subscription.current_period_start)
        if subscription
        else "Not available"
    )
    period_end = (
        format_datetime(subscription.current_period_end)
        if subscription
        else "Not available"
    )
    plan_name = plan.name if plan else "Not assigned"

    custom_invoice = None
    if plan and plan.slug == "custom":
        custom_invoice = (
            PaymentInvoice.objects.filter(
                organization=organization,
                status=PaymentInvoice.Status.PAID,
                snapshot_limits__custom_plan=True,
            )
            .order_by("-verified_at")
            .first()
        )
    limits_source = custom_invoice.snapshot_limits if custom_invoice else plan
    limits = limits_text(limits_source) if limits_source else "Plan limits are not assigned yet."

    is_lifetime = (
        getattr(subscription, "access_type", "") == "lifetime"
        or (plan and getattr(plan, "channel", "") == "appsumo")
        or hasattr(organization, "appsumo_entitlement")
    )

    if is_lifetime:
        period_text = (
            f"Access type: Lifetime Access (No renewal payments required)\n"
            f"Current usage cycle: {period_start} to {period_end}\n"
            f"Next quota reset: Resets on {period_end}\n\n"
        )
    else:
        period_text = (
            f"Billing period: {period_start} to {period_end}\n"
            f"Next billing period: starts after {period_end}\n\n"
        )

    body = (
        f"Hello {user.name or user.username},\n\n"
        "Your Mail Flow account has been created.\n\n"
        f"Account email: {user.email}\n"
        f"Organization: {organization.name}\n"
        f"Role: {user.get_role_display()}\n"
        f"Plan: {plan_name}\n"
        f"{period_text}"
        f"{limits}\n\n"
        f"Sign in: {login_url}\n\n"
        "Use the password you set during signup. If an administrator created this account, ask them for your temporary password."
    )
    rows = [
        ("Account Email", user.email),
        ("Organization", organization.name),
        ("Role", user.get_role_display()),
        ("Plan", plan_name),
    ]
    if is_lifetime:
        rows.extend([
            ("Access Type", "Lifetime Access ($0 Renewal)"),
            ("Current Usage Cycle", f"{period_start} to {period_end}"),
            ("Next Quota Reset", f"Resets on {period_end}"),
        ])
    else:
        rows.extend([
            ("Current Billing Period", f"{period_start} to {period_end}"),
            ("Next Billing Period", f"Starts after {period_end}"),
        ])

    badge = "AppSumo Lifetime" if is_lifetime else "Account Created"
    footer_note = (
        "Your lifetime access never expires. Monthly sending allowances reset automatically with zero renewal fees."
        if is_lifetime
        else "Use the password configured during onboarding or provided by your organization administrator."
    )

    html = build_html_shell(
        "Your Mail Flow Account is Ready",
        f"Hello {user.name or user.username}, your Mail Flow account has been created with the details below.",
        rows,
        login_url,
        "Sign In to Mail Flow",
        badge=badge,
        footer_note=footer_note,
        template_name="emails/billing/account_created.html",
    )
    send_system_email("Your Mail Flow account is ready", body, user.email, html, sender="general")


def deliver_appsumo_activation_email(user: Any, tier: int, state: dict[str, Any]) -> None:
    organization = user.organization
    current_tier = state.get("tier", tier)
    period_start_str = format_datetime(state.get("period_start"))
    period_end_str = format_datetime(state.get("period_end"))
    limits = state.get("limits", {})
    emails_limit = format_limit(limits.get("emails", 0))
    contacts_limit = format_limit(limits.get("contacts", 0))
    mailboxes_limit = format_limit(limits.get("mailboxes", 0))
    seats_limit = format_limit(limits.get("seats", 0))

    workspace_url = f"{settings.FRONTEND_URL.rstrip('/')}/mail-workspace"
    billing_url = f"{settings.FRONTEND_URL.rstrip('/')}/billing"

    subject = "Your Mail Flow AppSumo lifetime access is active"
    body = (
        f"Hello {user.name or user.username},\n\n"
        f"Your AppSumo code activated Tier {tier}. Your workspace is now on Tier {current_tier} with lifetime access.\n\n"
        f"Account Email: {user.email}\n"
        f"Organization: {organization.name if organization else 'Your Workspace'}\n"
        f"Access Type: Lifetime ($0 Renewal - No payment required)\n"
        f"Current Usage Cycle: {period_start_str} to {period_end_str}\n"
        f"Next Quota Reset: Resets on {period_end_str}\n\n"
        f"Tier Allowances:\n"
        f"• Monthly Email Sending Quota: {emails_limit} per month\n"
        f"• Stored Contacts: {contacts_limit}\n"
        f"• Connected Inboxes / SMTP: {mailboxes_limit}\n"
        f"• Team Seats: {seats_limit}\n\n"
        f"Open Mail Workspace to get started: {workspace_url}\n"
        f"Review your allowances or stack additional codes in Account Billing: {billing_url}\n\n"
        "No renewal payment is required."
    )

    rows = [
        ("Account Email", user.email),
        ("Organization", organization.name if organization else "Workspace"),
        ("Activated Tier", f"AppSumo Tier {current_tier}"),
        ("Access Type", "Lifetime ($0 Renewal)"),
        ("Monthly Email Quota", f"{emails_limit} / month"),
        ("Stored Contacts", contacts_limit),
        ("Connected Inboxes", mailboxes_limit),
        ("Team Seats", seats_limit),
        ("Current Usage Cycle", f"{period_start_str} to {period_end_str}"),
        ("Next Quota Reset", f"Resets on {period_end_str}"),
    ]

    html = build_html_shell(
        "AppSumo Lifetime Access Active",
        f"Hello {user.name or user.username}, your AppSumo code has activated Tier {tier}. "
        f"Your workspace is now active on <strong>AppSumo Lifetime Tier {current_tier}</strong>.",
        rows=rows,
        cta_url=workspace_url,
        cta_label="Open Mail Workspace",
        badge=f"AppSumo Tier {current_tier} Active",
        footer_note="Your lifetime access never expires. Monthly sending allowances refresh automatically every 30 days with no renewal payments required.",
        template_name="emails/billing/account_created.html",
    )
    send_system_email(subject, body, user.email, html=html, sender="billing")


def deliver_renewal_reminder_email(delivery: Any, admin_name: Optional[str] = None) -> None:
    subscription = delivery.subscription
    organization = subscription.organization
    plan = subscription.plan
    renewal_date_str = format_datetime(delivery.renewal_date)
    greeting_name = admin_name or "Administrator"
    dashboard_url = f"{settings.FRONTEND_URL.rstrip('/')}/login"

    subject = f"Upcoming Subscription Renewal - {organization.name}"
    intro = f"Hello {greeting_name}, your Mail Flow subscription for {organization.name} is scheduled to renew soon."

    rows = [
        ("Organization", organization.name),
        ("Plan", plan.name),
        ("Renewal Date", renewal_date_str),
        ("Status", "Active"),
    ]

    body = (
        f"Hello {greeting_name},\n\n"
        f"Your Mail Flow subscription for {organization.name} is entering its renewal window.\n\n"
        f"Organization: {organization.name}\n"
        f"Plan: {plan.name}\n"
        f"Renewal date: {renewal_date_str}\n\n"
        f"Manage billing & account: {dashboard_url}\n\n"
        "Thank you for using Mail Flow."
    )

    html = build_html_shell(
        "Upcoming Subscription Renewal",
        intro,
        rows,
        dashboard_url,
        "Manage Subscription",
        badge="Renewal Reminder",
        footer_note="To ensure uninterrupted service, please make sure your payment details or invoice renewals are up to date.",
        template_name="emails/billing/renewal_reminder.html",
    )

    send_system_email(subject, body, delivery.recipient_email, html=html, sender="billing")


# --- Custom Plan Quotes & Post-Payment Activation Emails ---

def deliver_custom_quote_received_email(quote: Any) -> None:
    subject = f"Custom Plan Quote Request Received - {quote.quote_number}"
    intro = f"Hello {quote.customer_name}, we have received your custom plan request for {quote.organization_name}."
    rows = [
        ("Quote Number", quote.quote_number),
        ("Organization", quote.organization_name),
        ("Monthly Email Limit", f"{quote.requested_limits.get('email_limit', 0):,}"),
        ("Admin Accounts", str(quote.requested_limits.get("max_admins", 0))),
        ("Team Members", str(quote.requested_limits.get("max_users", 0))),
        ("SMTP Connections", str(quote.requested_limits.get("max_smtp_accounts", 0))),
        ("Status", "Under Review"),
    ]
    body = (
        f"Hello {quote.customer_name},\n\n"
        f"We have received your custom plan request (Quote #{quote.quote_number}) for {quote.organization_name}.\n"
        "Our enterprise pricing team is reviewing your requirements and will generate your tailored invoice shortly.\n\n"
        "Thank you for choosing Mail Flow."
    )
    html = build_html_shell(
        "Custom Plan Quote Request Received",
        intro,
        rows,
        f"{settings.FRONTEND_URL.rstrip('/')}/pricing",
        "View Pricing Overview",
        badge="Quote Submitted",
        footer_note="You will receive an email as soon as your custom invoice is approved and ready for payment.",
    )
    send_system_email(subject, body, quote.customer_email, html=html, sender="billing")


def deliver_owner_quote_alert_email(quote: Any) -> None:
    owner_email = settings.MAIL_FLOW_GENERAL_SENDER_EMAIL or getattr(settings, "OWNER_ALERT_EMAIL", "admin@mailflow.io")
    subject = f"New Enterprise Custom Quote Submitted - {quote.quote_number}"
    intro = f"A new enterprise custom plan quote #{quote.quote_number} has been submitted for {quote.organization_name}."
    rows = [
        ("Quote Number", quote.quote_number),
        ("Customer Name", quote.customer_name),
        ("Customer Email", quote.customer_email),
        ("Organization", quote.organization_name),
        ("Monthly Emails", f"{quote.requested_limits.get('email_limit', 0):,}"),
        ("SMTP Connections", str(quote.requested_limits.get("max_smtp_accounts", 0))),
    ]
    review_url = f"{settings.FRONTEND_URL.rstrip('/')}/platform/custom-quotes"
    body = (
        f"Enterprise Quote Alert:\n"
        f"Quote #{quote.quote_number} for {quote.organization_name} ({quote.customer_email})\n"
        f"Review & Issue Invoice: {review_url}\n"
    )
    html = build_html_shell(
        "New Custom Quote Pending Review",
        intro,
        rows,
        review_url,
        "Review Quote & Price",
        badge="Action Required",
        footer_note="Set the approved BDT price and select the receiving USDT network to generate a 72-hour invoice.",
    )
    send_system_email(subject, body, owner_email, html=html, sender="billing")


def deliver_custom_quote_invoice_email(quote: Any) -> None:
    invoice = quote.invoice
    pay_url = invoice_link(invoice)
    subject = f"Your Custom Plan Invoice is Ready (72h Expiration) - {quote.quote_number}"
    intro = f"Hello {quote.customer_name}, your enterprise quote #{quote.quote_number} for {quote.organization_name} has been approved."
    expires_str = format_datetime(invoice.expires_at)
    rows = [
        ("Quote Number", quote.quote_number),
        ("Organization", quote.organization_name),
        ("Approved Price (BDT)", f"BDT {invoice.price_bdt:,}"),
        ("USDT Amount", f"{invoice.amount_usdt} USDT"),
        ("Network", invoice.get_network_display()),
        ("Expires At", expires_str),
    ]
    body = (
        f"Hello {quote.customer_name},\n\n"
        f"Your custom plan invoice for {quote.organization_name} is ready.\n\n"
        f"Amount: {invoice.amount_usdt} USDT ({invoice.get_network_display()})\n"
        f"Invoice expires in 72 hours on: {expires_str}\n\n"
        f"Pay Invoice: {pay_url}\n\n"
        "After payment is confirmed on-chain, you will be invited to set up your workspace admin password."
    )
    html = build_html_shell(
        "Custom Plan Invoice Ready",
        intro,
        rows,
        pay_url,
        "Pay Invoice Now",
        badge="72-Hour Invoice",
        footer_note="Please send the exact USDT amount before the 72-hour window expires to avoid micro-rate recalculations.",
    )
    send_system_email(subject, body, quote.customer_email, html=html, sender="billing")


def deliver_custom_quote_rejected_email(quote: Any) -> None:
    subject = f"Update Regarding Your Custom Quote - {quote.quote_number}"
    intro = f"Hello {quote.customer_name}, thank you for your interest in Mail Flow enterprise solutions."
    rows = [
        ("Quote Number", quote.quote_number),
        ("Organization", quote.organization_name),
        ("Status", "Declined"),
        ("Reason", quote.rejection_reason or "Requirements outside current supported capacity"),
    ]
    body = (
        f"Hello {quote.customer_name},\n\n"
        f"Regarding your custom plan quote #{quote.quote_number} for {quote.organization_name}:\n"
        f"We are unable to approve this custom configuration at this time.\n\n"
        f"Reason: {quote.rejection_reason or 'Unsupported configuration'}\n\n"
        "Feel free to check our standard plans or submit an adjusted quote request."
    )
    html = build_html_shell(
        "Quote Request Update",
        intro,
        rows,
        f"{settings.FRONTEND_URL.rstrip('/')}/pricing",
        "View Standard Plans",
        badge="Quote Update",
        footer_note="If you have questions, please reach out to our enterprise support desk.",
    )
    send_system_email(subject, body, quote.customer_email, html=html, sender="billing")


def deliver_owner_payment_exception_email(invoice: Any, reason: str) -> None:
    owner_email = settings.MAIL_FLOW_GENERAL_SENDER_EMAIL or getattr(settings, "OWNER_ALERT_EMAIL", "admin@mailflow.io")
    subject = f"Payment Exception Flagged: {reason} on Invoice #{invoice.id}"
    review_url = f"{settings.FRONTEND_URL.rstrip('/')}/platform/custom-quotes"
    symbol, amount_str, _ = _invoice_crypto_data(invoice)
    rows = [
        ("Invoice ID", str(invoice.id)),
        ("Expected Amount", amount_str),
        ("Network", invoice.get_network_display()),
        ("Flagged Reason", reason),
        ("Transaction Hash", invoice.transaction_hash or "N/A"),
    ]
    body = f"Payment Exception Alert: {reason} on invoice {invoice.id}.\nExpected: {amount_str}\nReview queue: {review_url}\n"
    html = build_html_shell(
        "Payment Exception Flagged",
        f"A blockchain payment requires manual review: {reason}",
        rows,
        review_url,
        "Review Payment Exception",
        badge="Exception Alert",
        footer_note="Investigate the transaction hash on the blockchain explorer before approving or rejecting.",
    )
    send_system_email(subject, body, owner_email, html=html, sender="billing")


def deliver_custom_quote_payment_confirmed_email(quote: Any, raw_intent_token: str) -> None:

    activation_url = f"{settings.FRONTEND_URL.rstrip('/')}/activate-custom-plan/{raw_intent_token}"
    subject = f"Payment Confirmed! Activate Your Workspace - {quote.organization_name}"
    intro = f"Hello {quote.customer_name}, we have confirmed your on-chain payment for {quote.organization_name}."
    rows = [
        ("Quote Number", quote.quote_number),
        ("Organization", quote.organization_name),
        ("Plan", "Enterprise Custom"),
        ("Monthly Emails", f"{quote.approved_limits.get('email_limit', 0):,}"),
        ("Payment Status", "Confirmed"),
    ]
    body = (
        f"Hello {quote.customer_name},\n\n"
        f"Your payment for {quote.organization_name} has been verified on-chain!\n\n"
        f"Activate your workspace & set your admin password: {activation_url}\n\n"
        "For your security, you will be asked to verify a one-time code sent to this email address."
    )
    html = build_html_shell(
        "Payment Confirmed - Activate Workspace",
        intro,
        rows,
        activation_url,
        "Activate Workspace & Set Password",
        badge="Payment Verified",
        footer_note="This secure activation link will expire in 7 days. Please do not forward this email.",
    )
    send_system_email(subject, body, quote.customer_email, html=html, sender="billing")


def deliver_custom_activation_otp_email(email: str, otp: str, organization_name: str) -> None:
    subject = f"{otp} is your Mail Flow workspace activation code"
    intro = f"Use this verification code to confirm ownership of {email} and activate your workspace for {organization_name}."
    rows = [
        ("Verification Code", otp),
        ("Organization", organization_name),
        ("Code Validity", "10 minutes"),
    ]
    body = (
        f"Your Mail Flow activation code is: {otp}\n\n"
        f"This code will expire in 10 minutes.\n"
        f"If you did not initiate this activation, please contact support immediately."
    )
    html = build_html_shell(
        "Confirm Workspace Activation",
        intro,
        rows,
        "",
        "",
        badge="Security Verification",
        footer_note="Never share your verification code with anyone.",
    )
    send_system_email(subject, body, email, html=html, sender="billing")


def deliver_custom_quote_payment_rejected_email(quote: Any, reason: str = "") -> None:
    subject = f"Payment Exception Rejected - {quote.quote_number}"
    intro = f"Hello {quote.customer_name}, the payment claim for {quote.organization_name} has been reviewed and rejected."
    rows = [
        ("Quote Number", quote.quote_number),
        ("Organization", quote.organization_name),
        ("Status", "Payment Rejected"),
        ("Reason", reason or "Invalid or unverified transaction claim"),
    ]
    body = (
        f"Hello {quote.customer_name},\n\n"
        f"Your payment claim for quote #{quote.quote_number} ({quote.organization_name}) could not be verified and has been rejected.\n\n"
        f"Reason: {reason or 'Invalid or unverified transaction'}\n\n"
        "If you believe this is an error, please contact our enterprise support team with your transaction hash."
    )
    html = build_html_shell(
        "Payment Exception Rejected",
        intro,
        rows,
        f"{settings.FRONTEND_URL.rstrip('/')}/pricing",
        "View Enterprise Pricing",
        badge="Payment Rejected",
        footer_note="For payment disputes or assistance, contact support.",
    )
    send_system_email(subject, body, quote.customer_email, html=html, sender="billing")


def deliver_custom_workspace_ready_email(quote: Any) -> None:
    login_url = f"{settings.FRONTEND_URL.rstrip('/')}/login"
    subject = f"Your Custom Enterprise Workspace is Ready - {quote.organization_name}"
    intro = f"Hello {quote.customer_name}, your enterprise workspace {quote.organization_name} is now live and fully activated!"
    admin_username = quote.activated_user.username if getattr(quote, "activated_user", None) else quote.customer_email.split("@")[0]
    rows = [
        ("Organization", quote.organization_name),
        ("Admin Username", admin_username),
        ("Admin Email", quote.customer_email),
        ("Plan", "Enterprise Custom"),
        ("Monthly Emails", f"{quote.approved_limits.get('email_limit', 0):,}"),
        ("SMTP Connections", str(quote.approved_limits.get("max_smtp_accounts", 0))),
        ("Status", "Active (30-Day Subscription)"),
    ]
    body = (
        f"Hello {quote.customer_name},\n\n"
        f"Your enterprise workspace for {quote.organization_name} has been provisioned!\n\n"
        f"Sign in at: {login_url}\n"
        f"Login Username: {admin_username}\n"
        f"Login Email: {quote.customer_email}\n\n"
        "Use the password you configured during activation."
    )
    html = build_html_shell(
        "Workspace Successfully Provisioned",
        intro,
        rows,
        login_url,
        "Sign In to Your Workspace",
        badge="Workspace Live",
        footer_note="Welcome to Mail Flow Enterprise. Let us know if you need any assistance getting started.",
    )
    send_system_email(subject, body, quote.customer_email, html=html, sender="general")


def deliver_lead_hunter_plus_welcome_email(user_email: str, plan_name: str = "Pro") -> None:
    """
    Sends the official Lead Hunter companion onboarding email using Mail Flow's standard brand shell.
    Includes direct ZIP download link and step-by-step Chrome installation guide.
    """
    download_url = "https://mail.annomous.com/lead-hunter/lead-hunter.zip"
    subject = "Welcome to Mail Flow - Your Lead Hunter Pro Access is Ready! 🚀"
    intro = (
        f"Your access to Mail Flow - Lead Hunter ({plan_name} Edition) has been activated for {user_email}. "
        "Follow the quick 30-second setup below to install the extension and start extracting verified B2B leads."
    )
    
    rows = [
        ("Account Email", user_email),
        ("Lead Hunter Tier", f"{plan_name} Edition"),
        ("Lead Engines", "Maps, IG, FB, Fiverr, VIP Hub"),
        ("Direct Export", "1-Click Push to Mail Flow"),
        ("Status", "Active"),
    ]
    
    custom_content = (
        f"<div style=\"background-color:#0B0F17;border:1px solid #1E293B;border-radius:10px;padding:20px;margin:20px 0;\">"
        f"<div style=\"display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;\">"
        f"<div style=\"font-size:12px;font-weight:700;color:#38BDF8;text-transform:uppercase;letter-spacing:0.08em;\">📥 Step 1: Download & Install (30 Seconds)</div>"
        f"<span style=\"font-size:10.5px;color:#FCD34D;background:rgba(251,191,36,0.12);border:1px solid rgba(251,191,36,0.3);padding:2px 8px;border-radius:10px;font-weight:600;\">Web Store: Coming Soon</span>"
        f"</div>"
        f"<ol style=\"margin:0;padding-left:18px;color:#CBD5E1;font-size:13px;line-height:1.75;\">"
        f"<li style=\"margin-bottom:8px;\"><strong>Download ZIP:</strong> Download the extension package from <a href=\"{download_url}\" target=\"_blank\" style=\"color:#38BDF8;font-weight:600;text-decoration:underline;\">{download_url}</a></li>"
        f"<li style=\"margin-bottom:8px;\"><strong>Extract:</strong> Unzip <code>lead-hunter.zip</code> into a folder on your computer.</li>"
        f"<li style=\"margin-bottom:8px;\"><strong>Open Chrome Extensions:</strong> In Google Chrome, go to <code style=\"background:#1E293B;padding:2px 6px;border-radius:4px;color:#A5B4FC;\">chrome://extensions</code></li>"
        f"<li style=\"margin-bottom:8px;\"><strong>Enable Developer Mode:</strong> In the top-right corner, toggle <strong>ON</strong> <code>Developer mode</code>.</li>"
        f"<li style=\"margin-bottom:8px;\"><strong>Load Extension:</strong> Click <strong style=\"color:#34D399;\">Load unpacked</strong> (top-left) and select your unzipped folder.</li>"
        f"<li><strong>Pin to Toolbar:</strong> Click the Extensions puzzle icon in Chrome and pin <strong>Mail Flow - Lead Hunter</strong>.</li>"
        f"</ol>"
        f"</div>"
        f"<div style=\"background:rgba(52,211,153,0.08);border:1px solid rgba(52,211,153,0.25);border-radius:8px;padding:14px 16px;margin-bottom:20px;\">"
        f"<div style=\"font-size:12px;font-weight:700;color:#34D399;margin-bottom:4px;\">🔑 Step 2: Instant Activation</div>"
        f"<div style=\"font-size:12.5px;color:#E2E8F0;line-height:1.5;\">"
        f"Open the extension popup, enter your registered email (<strong style=\"color:#F8FAFC;\">{escape(user_email)}</strong>), and click <strong style=\"color:#38BDF8;\">Activate Lead Hunter</strong>."
        f"</div>"
        f"</div>"
        f"<div style=\"font-size:11.5px;color:#94A3B8;line-height:1.5;\">"
        f"⚡ <strong>Included Extraction Modules:</strong> Google Maps B2B, Instagram Hunter, Facebook Client Hunter, Fiverr Prospector, and VIP Directory Hub with 1-Click direct push into your Mail Flow campaign recipient lists."
        f"</div>"
    )
    
    cta_url = download_url
    cta_label = "📥 Download Lead Hunter (ZIP)"
    
    body = (
        f"Hello,\n\n"
        f"Your access to Mail Flow - Lead Hunter ({plan_name} Edition) has been activated for {user_email}!\n\n"
        f"--------------------------------------------------\n"
        f"📥 DOWNLOAD EXTENSION\n"
        f"--------------------------------------------------\n"
        f"Direct ZIP Download: {download_url}\n"
        f"(Chrome Web Store 1-click install: Coming Soon)\n\n"
        f"--------------------------------------------------\n"
        f"🛠️ HOW TO INSTALL IN GOOGLE CHROME (30 Seconds)\n"
        f"--------------------------------------------------\n"
        f"1. Download the ZIP from: {download_url}\n"
        f"2. Extract / unzip the folder on your computer.\n"
        f"3. In Google Chrome, go to: chrome://extensions\n"
        f"4. In the top-right corner, turn ON 'Developer mode'.\n"
        f"5. Click 'Load unpacked' (top-left) and select the unzipped folder.\n"
        f"6. Pin 'Mail Flow - Lead Hunter' to your Chrome toolbar.\n\n"
        f"--------------------------------------------------\n"
        f"🔑 ACTIVATION\n"
        f"--------------------------------------------------\n"
        f"1. Open the Lead Hunter extension.\n"
        f"2. Enter your account email: {user_email}\n"
        f"3. Click 'Activate Lead Hunter' and start prospecting!\n\n"
        f"Best regards,\n"
        f"The Mail Flow Team\n"
        f"https://mail-flow.annomous.com"
    )
    
    html = build_html_shell(
        "Lead Hunter Pro Unlocked",
        intro,
        rows=rows,
        cta_url=cta_url,
        cta_label=cta_label,
        custom_content=custom_content,
        badge="Lead Hunter Pro",
        footer_note="Need help with lead generation or cold outreach? Contact our support team anytime.",
    )
    send_system_email(subject, body, user_email, html=html, sender="billing")


def deliver_lead_hunter_device_otp_email(email: str, code: str) -> None:
    subject = f"Your Mail Flow Lead Hunter verification code: {code}"
    body = (
        f"Your Mail Flow Lead Hunter device verification code is {code}.\n\n"
        "This code expires in 5 minutes. Enter it in the Lead Hunter extension to authorize this computer.\n\n"
        "If you did not request this code, please change your Mail Flow password immediately."
    )
    custom_content = (
        "<div style=\"background-color:#0B0F17;border:1px solid #1E293B;border-radius:10px;padding:22px;text-align:center;margin:20px 0;box-shadow:inset 0 2px 4px rgba(0,0,0,0.4);\">"
        "<div style=\"font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;\">Lead Hunter Device Code</div>"
        f"<div style=\"font-size:34px;font-weight:800;letter-spacing:8px;color:#38BDF8;font-family:monospace;text-shadow:0 0 16px rgba(56,189,248,0.25);\">{escape(code)}</div>"
        "<div style=\"font-size:12px;color:#64748B;margin-top:8px;\">Expires in 5 minutes</div>"
        "</div>"
        "<div style=\"background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.22);border-radius:8px;padding:14px 16px;margin:18px 0;\">"
        "<div style=\"font-size:12px;font-weight:700;color:#38BDF8;margin-bottom:5px;\">Device authorization requested</div>"
        f"<div style=\"font-size:12.5px;color:#CBD5E1;line-height:1.55;\">Enter this code in the Mail Flow Lead Hunter extension to authorize this computer for <strong style=\"color:#F8FAFC;\">{escape(email)}</strong>.</div>"
        "</div>"
    )
    html = build_html_shell(
        "Lead Hunter Device Verification",
        "Use the verification code below to authorize this computer for Mail Flow Lead Hunter.",
        rows=[
            ("Account Email", email),
            ("Product", "Mail Flow Lead Hunter"),
            ("Status", "Device Verification"),
            ("Code Expiry", "5 minutes"),
        ],
        custom_content=custom_content,
        badge="Lead Hunter Security",
        footer_note="Never share this code. Mail Flow staff will never ask for your verification code.",
        template_name="emails/billing/checkout_otp.html",
    )
    send_system_email(subject, body, email, html=html, sender="billing")


def provision_lead_hunter_license(user_email: str, plan_name: str = "Pro", days: int = 30) -> bool:
    """
    Provisions or extends a Lead Hunter license via the cPanel relay.
    """
    relay_url = getattr(settings, "MAIL_FLOW_LEADHUNT_RELAY_URL", "https://mail.annomous.com/mailflow-leadhunt-relay.php")
    relay_secret = getattr(settings, "MAIL_FLOW_LEADHUNT_RELAY_SECRET", getattr(settings, "MAIL_FLOW_OTP_RELAY_SECRET", ""))

    try:
        payload = {
            "action": "provision",
            "email": user_email.lower().strip(),
            "plan": plan_name,
            "days": days,
        }
        headers = {
            "Content-Type": "application/json",
            "X-Mail-Flow-Secret": relay_secret,
        }
        resp = requests.post(relay_url, json=payload, headers=headers, timeout=10)
        return resp.status_code == 200 and resp.json().get("ok", False)
    except Exception:
        return False


