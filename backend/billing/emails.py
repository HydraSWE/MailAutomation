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
            "accent": any(token in value_text for token in ("USDT", "http", "Active", "Confirmed")),
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


def deliver_invoice_email(invoice: PaymentInvoice, *, recovery: bool = False) -> None:
    link = invoice_link(invoice)
    purpose = "Resume your USDT payment" if recovery else "Your USDT invoice is ready"
    network_label = dict(PaymentInvoice.Network.choices).get(invoice.network, invoice.network)
    rows = [
        ("Invoice ID", invoice.pk),
        ("Account", invoice.customer_email),
        ("Organization", invoice.organization_name),
        ("Plan", invoice.plan.name),
        ("Plan price", f"BDT {invoice.price_bdt:,}"),
        ("USDT quote", f"{invoice.amount_usdt} USDT"),
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
        f"Amount: {invoice.amount_usdt} USDT\n"
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
            "<div style=\"font-size:12px;color:#94A3B8;margin-top:3px;line-height:1.4;\">Your USDT quote is still active. Use the button below to resume and complete your transaction directly on the blockchain.</div>"
            "</td>"
            "</tr>"
            "</table>"
            "</td>"
            "</tr>"
            "</table>"
        )
        intro_text = f"Hello {invoice.customer_name}, we noticed your USDT payment is still pending. You can resume and complete your payment below before the quote expires."
        cta_label = "Resume USDT Payment"
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

    body = (
        f"Hello {invoice.customer_name},\n\nPayment confirmed. Your {invoice.plan.name} plan is active.\n"
        f"Amount: {invoice.amount_usdt} USDT\nNetwork: {network_label}\n"
        f"Transaction: {explorer}{invoice.transaction_hash}\n"
        f"Next billing period starts after: {period_end_str}\n\n"
        f"Sign in: {login_url}"
    )
    rows = [
        ("Organization", invoice.organization_name),
        ("Plan", invoice.plan.name),
        ("Amount", f"{invoice.amount_usdt} USDT"),
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
    body = (
        f"Hello {invoice.customer_name},\n\nWe found your USDT transfer, but it arrived after the quote expired. "
        "The payment has been placed in manual review. We will contact you after it is resolved.\n\n"
        f"Invoice: {invoice.pk}\nTransaction: {invoice.transaction_hash or 'Recorded'}"
    )
    rows = [
        ("Invoice ID", invoice.pk),
        ("Organization", invoice.organization_name),
        ("Plan", invoice.plan.name),
        ("Transaction Hash", invoice.transaction_hash or "Recorded"),
        ("Status", "Under Manual Review"),
    ]
    html = build_html_shell(
        "Payment Under Review",
        f"Hello {invoice.customer_name}, your USDT transfer arrived after the invoice expired and has been queued for manual review.",
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

    body = (
        f"Hello {user.name or user.username},\n\n"
        "Your Mail Flow account has been created.\n\n"
        f"Account email: {user.email}\n"
        f"Organization: {organization.name}\n"
        f"Role: {user.get_role_display()}\n"
        f"Plan: {plan_name}\n"
        f"Billing period: {period_start} to {period_end}\n"
        f"Next billing period: starts after {period_end}\n\n"
        f"{limits}\n\n"
        f"Sign in: {login_url}\n\n"
        "Use the password you set during signup. If an administrator created this account, ask them for your temporary password."
    )
    rows = [
        ("Account Email", user.email),
        ("Organization", organization.name),
        ("Role", user.get_role_display()),
        ("Plan", plan_name),
        ("Current Billing Period", f"{period_start} to {period_end}"),
        ("Next Billing Period", f"Starts after {period_end}"),
    ]
    html = build_html_shell(
        "Your Mail Flow Account is Ready",
        f"Hello {user.name or user.username}, your Mail Flow account has been created with the details below.",
        rows,
        login_url,
        "Sign In to Mail Flow",
        badge="Account Created",
        footer_note="Use the password configured during onboarding or provided by your organization administrator.",
        template_name="emails/billing/account_created.html",
    )
    send_system_email("Your Mail Flow account is ready", body, user.email, html, sender="general")


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
