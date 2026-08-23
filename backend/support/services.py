import email
import base64
import hashlib
import hmac
import json
import re
import time
import uuid
from email.header import decode_header, make_header
from email.utils import parseaddr

import requests
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import SupportMailbox, SupportMessage, SupportTicket


def next_ticket_number():
    prefix = "MF"
    stamp = timezone.now().strftime("%y%m%d")
    base = f"{prefix}-{stamp}"
    count = SupportTicket.objects.filter(ticket_number__startswith=base).count() + 1
    return f"{base}-{count:04d}"


def create_support_ticket(*, name, email_address, subject, body, organization=None, requester=None, source="public", mailbox=None):
    with transaction.atomic():
        ticket = SupportTicket.objects.create(
            organization=organization,
            requester=requester,
            mailbox=mailbox,
            ticket_number=next_ticket_number(),
            name=name.strip() or email_address,
            email=email_address.strip().lower(),
            subject=subject.strip() or "Support request",
            source=source,
            last_message_at=timezone.now(),
        )
        SupportMessage.objects.create(
            ticket=ticket,
            direction=SupportMessage.Direction.INBOUND,
            sender_name=ticket.name,
            sender_email=ticket.email,
            recipient_email=(mailbox.email if mailbox else settings.MAIL_FLOW_REPLY_TO or "support@annomous.com"),
            subject=ticket.subject,
            body=body.strip(),
        )
    notify_support_team(ticket)
    return ticket


def notify_support_team(ticket):
    try:
        from billing.tasks import _send_message

        recipient = settings.MAIL_FLOW_REPLY_TO or "support@annomous.com"
        # This is an external alert only. The original ticket already exists in
        # the platform workspace, so keep the email body to the user's message.
        body = ticket.messages.first().body if ticket.messages.exists() else ""
        _send_message(
            f"Support request {ticket.ticket_number} - {ticket.subject}",
            body,
            recipient,
            sender="general",
        )
    except Exception:
        pass


def send_support_reply(ticket, body, *, actor, mailbox=None):
    mailbox = mailbox or ticket.mailbox
    subject = ticket.subject if ticket.subject.lower().startswith("re:") else f"Re: {ticket.subject}"
    if mailbox:
        result = send_via_mailbox(mailbox, ticket.email, subject, body)
        if not result["ok"]:
            raise RuntimeError(result["message"])
    else:
        from billing.tasks import _send_message

        _send_message(subject, body, ticket.email, sender="general")
    message = SupportMessage.objects.create(
        ticket=ticket,
        direction=SupportMessage.Direction.OUTBOUND,
        sender_name=getattr(actor, "name", "") or getattr(actor, "username", "") or "Support",
        sender_email=(mailbox.email if mailbox else settings.MAIL_FLOW_GENERAL_SENDER_EMAIL),
        recipient_email=ticket.email,
        subject=subject,
        body=body,
        created_by=actor,
    )
    ticket.status = SupportTicket.Status.WAITING
    ticket.last_message_at = timezone.now()
    ticket.save(update_fields=("status", "last_message_at", "updated_at"))
    return message


def mailbox_relay_payload(mailbox, recipient, subject, body):
    return {
        "encryption": str(mailbox.smtp_encryption or "tls").lower(),
        "from_email": str(mailbox.email),
        "from_name": str(mailbox.from_name or mailbox.name or "Mail Flow Support"),
        "host": str(mailbox.smtp_host),
        "password": str(mailbox.get_smtp_password()),
        "port": int(mailbox.smtp_port or 587),
        "reply_to": str(mailbox.email),
        "username": str(mailbox.smtp_username),
    }, {
        "body": str(body),
        "recipient": str(recipient).strip().lower(),
        "subject": str(subject),
    }


def send_via_mailbox(mailbox, recipient, subject, body):
    return _send_via_mailbox_relay(mailbox, recipient, subject, body)


def _send_via_mailbox_relay(mailbox, recipient, subject, body):
    relay_url = getattr(settings, "MAIL_FLOW_SMTP_TEST_RELAY_URL", "")
    relay_secret = getattr(settings, "MAIL_FLOW_SMTP_TEST_RELAY_SECRET", "")
    if not relay_url or not relay_secret:
        return {"ok": False, "message": "Mailbox SMTP PHP relay is not configured.", "stage": "relay"}
    smtp_payload, message_payload = mailbox_relay_payload(mailbox, recipient, subject, body)
    timestamp = str(int(time.time()))
    payload = {
        "operation": "send_test",
        "request_id": str(uuid.uuid4()),
        "smtp": smtp_payload,
        "message": message_payload,
        "timestamp": timestamp,
    }
    raw_body = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    signature = hmac.new(relay_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    try:
        response = requests.post(
            relay_url,
            data=raw_body,
            headers={
                "Content-Type": "application/json",
                "X-Mail-Flow-Signature": signature,
                "X-Mail-Flow-Timestamp": timestamp,
            },
            timeout=getattr(settings, "MAIL_FLOW_SMTP_TEST_RELAY_TIMEOUT", 25),
        )
        try:
            response_data = response.json()
        except ValueError:
            response_data = {}
        return {
            "ok": bool(response_data.get("ok")),
            "message": str(response_data.get("message") or "Mailbox SMTP relay request failed.")[:300],
            "stage": str(response_data.get("stage") or "relay")[:40],
        }
    except requests.RequestException:
        return {"ok": False, "message": "Mailbox SMTP relay could not be reached.", "stage": "relay"}


def sync_mailbox(mailbox, *, limit=20):
    if not mailbox.is_active:
        return {"imported": 0, "detail": "Mailbox is inactive."}
    imported = 0
    try:
        result = imap_relay_request(mailbox, "sync", limit=limit)
        if not result["ok"]:
            raise RuntimeError(result["message"])
        for relay_message in result.get("messages", []):
            raw_value = relay_message.get("raw") if isinstance(relay_message, dict) else ""
            if not raw_value:
                continue
            try:
                raw = base64.b64decode(str(raw_value), validate=True)
            except (ValueError, TypeError):
                continue
            if raw and _import_message(mailbox, raw):
                imported += 1
        mailbox.last_synced_at = timezone.now()
        mailbox.last_error = ""
        mailbox.save(update_fields=("last_synced_at", "last_error", "updated_at"))
    except Exception as exc:
        mailbox.last_error = str(exc)[:4000]
        mailbox.save(update_fields=("last_error", "updated_at"))
        raise
    return {"imported": imported}


def imap_relay_payload(mailbox):
    return {
        "encryption": str(mailbox.imap_encryption or "ssl").lower(),
        "host": str(mailbox.imap_host),
        "mailbox": "INBOX",
        "password": str(mailbox.get_imap_password()),
        "port": int(mailbox.imap_port or 993),
        "username": str(mailbox.imap_username),
    }


def test_imap_via_relay(mailbox):
    return imap_relay_request(mailbox, "connection_test", limit=1)


def imap_relay_request(mailbox, operation, *, limit=20):
    relay_url = getattr(settings, "MAIL_FLOW_IMAP_SYNC_RELAY_URL", "")
    relay_secret = getattr(settings, "MAIL_FLOW_IMAP_SYNC_RELAY_SECRET", "")
    if not relay_url or not relay_secret:
        return {"ok": False, "message": "Mailbox IMAP PHP relay is not configured.", "stage": "relay", "messages": []}
    timestamp = str(int(time.time()))
    payload = {
        "operation": operation,
        "request_id": str(uuid.uuid4()),
        "imap": imap_relay_payload(mailbox),
        "limit": int(limit),
        "timestamp": timestamp,
    }
    raw_body = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    signature = hmac.new(relay_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    try:
        response = requests.post(
            relay_url,
            data=raw_body,
            headers={
                "Content-Type": "application/json",
                "X-Mail-Flow-Signature": signature,
                "X-Mail-Flow-Timestamp": timestamp,
            },
            timeout=getattr(settings, "MAIL_FLOW_IMAP_SYNC_RELAY_TIMEOUT", 30),
        )
        try:
            response_data = response.json()
        except ValueError:
            response_data = {}
        messages = response_data.get("messages") if isinstance(response_data.get("messages"), list) else []
        return {
            "ok": bool(response_data.get("ok")),
            "message": str(response_data.get("message") or response_data.get("detail") or "Mailbox IMAP relay request failed.")[:300],
            "stage": str(response_data.get("stage") or "relay")[:40],
            "messages": messages,
        }
    except requests.RequestException:
        return {"ok": False, "message": "Mailbox IMAP relay could not be reached.", "stage": "relay", "messages": []}


def _decode(value):
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except Exception:
        return str(value)


def _plain_body(message):
    if message.is_multipart():
        for part in message.walk():
            if part.get_content_type() == "text/plain" and "attachment" not in str(part.get("Content-Disposition", "")).lower():
                return _payload_text(part)
        return ""
    return _payload_text(message)


def _payload_text(part):
    payload = part.get_payload(decode=True) or b""
    charset = part.get_content_charset() or "utf-8"
    return payload.decode(charset, errors="replace")


def _import_message(mailbox, raw):
    parsed = email.message_from_bytes(raw)
    external_id = (parsed.get("Message-ID") or "").strip()
    # Handle platform support notifications before generic Message-ID
    # deduplication. Older releases may already have stored the notification as
    # a duplicate ticket, but we still need to link its original ticket.
    if _is_internal_support_notification(parsed):
        return _link_support_notification(mailbox, parsed, external_id)
    if external_id and (
        SupportMessage.objects.filter(external_message_id=external_id).exists()
        or SupportTicket.objects.filter(external_message_id=external_id).exists()
    ):
        return False
    sender_name, sender_email = parseaddr(parsed.get("From", ""))
    subject = _decode(parsed.get("Subject", "")) or "Support email"
    body = _plain_body(parsed).strip() or "(No plain-text body.)"
    ticket = SupportTicket.objects.create(
        organization=mailbox.organization,
        mailbox=mailbox,
        ticket_number=next_ticket_number(),
        name=_decode(sender_name) or sender_email,
        email=(sender_email or mailbox.email).lower(),
        subject=subject[:180],
        source="mailbox",
        external_message_id=external_id,
        last_message_at=timezone.now(),
    )
    SupportMessage.objects.create(
        ticket=ticket,
        direction=SupportMessage.Direction.INBOUND,
        sender_name=ticket.name,
        sender_email=ticket.email,
        recipient_email=mailbox.email,
        subject=subject[:180],
        body=body,
        external_message_id=external_id,
    )
    return True


def _is_internal_support_notification(parsed):
    """Prevent support-ticket notification emails from becoming tickets."""
    subject = _decode(parsed.get("Subject", ""))
    body = _plain_body(parsed).lstrip()
    _, sender_email = parseaddr(parsed.get("From", ""))
    return bool(
        subject.startswith("Support request MF-")
        and (
            body.startswith("New Mail Flow support request")
            or sender_email.lower() == settings.MAIL_FLOW_GENERAL_SENDER_EMAIL.lower()
        )
    )


def _link_support_notification(mailbox, parsed, external_id):
    """Link an inbox notification to its original support ticket."""
    if mailbox.organization_id is not None:
        return False
    subject = _decode(parsed.get("Subject", ""))
    match = re.match(r"^Support request (MF-\d{6}-\d+)\s+-", subject)
    if not match:
        return False
    ticket = SupportTicket.objects.filter(ticket_number=match.group(1)).first()
    if ticket is None:
        return False
    update_fields = []
    if ticket.mailbox_id != mailbox.id:
        ticket.mailbox = mailbox
        update_fields.append("mailbox")
    if external_id and not ticket.external_message_id:
        ticket.external_message_id = external_id
        update_fields.append("external_message_id")
    if not update_fields:
        return False
    ticket.save(update_fields=(*update_fields, "updated_at"))
    return True
