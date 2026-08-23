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


def _generate_outbound_message_id(mailbox=None, ticket=None):
    domain = "annomous.com"
    if mailbox and getattr(mailbox, "email", None) and "@" in mailbox.email:
        domain = mailbox.email.split("@")[-1].strip()
    elif ticket and getattr(ticket, "email", None) and "@" in ticket.email:
        domain = ticket.email.split("@")[-1].strip()
    return f"<mf-reply-{uuid.uuid4().hex}@{domain}>"


def _build_reply_headers(ticket):
    in_reply_to = ""
    last_inbound = (
        ticket.messages.filter(direction=SupportMessage.Direction.INBOUND)
        .exclude(external_message_id="")
        .order_by("-created_at", "-id")
        .first()
    )
    if last_inbound and last_inbound.external_message_id:
        in_reply_to = last_inbound.external_message_id
    else:
        last_msg = ticket.messages.exclude(external_message_id="").order_by("-created_at", "-id").first()
        if last_msg and last_msg.external_message_id:
            in_reply_to = last_msg.external_message_id
        elif ticket.external_message_id:
            in_reply_to = ticket.external_message_id

    ref_list = []
    if ticket.external_message_id:
        ref_list.append(ticket.external_message_id)
    for ext_id in ticket.messages.exclude(external_message_id="").order_by("created_at", "id").values_list("external_message_id", flat=True):
        if ext_id and ext_id not in ref_list:
            ref_list.append(ext_id)
    if in_reply_to and in_reply_to not in ref_list:
        ref_list.append(in_reply_to)

    references = " ".join(ref_list)
    return in_reply_to, references


def send_support_reply(ticket, body, *, actor, mailbox=None):
    mailbox = mailbox or ticket.mailbox
    subject = ticket.subject if ticket.subject.lower().startswith("re:") else f"Re: {ticket.subject}"
    outbound_message_id = _generate_outbound_message_id(mailbox, ticket)
    in_reply_to, references = _build_reply_headers(ticket)
    if mailbox:
        result = send_via_mailbox(
            mailbox,
            ticket.email,
            subject,
            body,
            message_id=outbound_message_id,
            in_reply_to=in_reply_to,
            references=references,
        )
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
        external_message_id=outbound_message_id,
        created_by=actor,
    )
    ticket.status = SupportTicket.Status.WAITING
    ticket.last_message_at = timezone.now()
    ticket.save(update_fields=("status", "last_message_at", "updated_at"))
    return message


def mailbox_relay_payload(mailbox, recipient, subject, body, *, message_id="", in_reply_to="", references=""):
    smtp_data = {
        "encryption": str(mailbox.smtp_encryption or "tls").lower(),
        "from_email": str(mailbox.email),
        "from_name": str(mailbox.from_name or mailbox.name or "Mail Flow Support"),
        "host": str(mailbox.smtp_host),
        "password": str(mailbox.get_smtp_password()),
        "port": int(mailbox.smtp_port or 587),
        "reply_to": str(mailbox.email),
        "username": str(mailbox.smtp_username),
    }
    msg_data = {
        "body": str(body),
        "recipient": str(recipient).strip().lower(),
        "subject": str(subject),
    }
    if message_id:
        msg_data["message_id"] = str(message_id).strip()
    if in_reply_to:
        msg_data["in_reply_to"] = str(in_reply_to).strip()
    if references:
        msg_data["references"] = str(references).strip()
    return smtp_data, msg_data


def send_via_mailbox(mailbox, recipient, subject, body, *, message_id="", in_reply_to="", references=""):
    return _send_via_mailbox_relay(mailbox, recipient, subject, body, message_id=message_id, in_reply_to=in_reply_to, references=references)


def _send_via_mailbox_relay(mailbox, recipient, subject, body, *, message_id="", in_reply_to="", references=""):
    relay_url = getattr(settings, "MAIL_FLOW_SMTP_TEST_RELAY_URL", "")
    relay_secret = getattr(settings, "MAIL_FLOW_SMTP_TEST_RELAY_SECRET", "")
    if not relay_url or not relay_secret:
        return {"ok": False, "message": "Mailbox SMTP PHP relay is not configured.", "stage": "relay"}
    smtp_payload, message_payload = mailbox_relay_payload(
        mailbox, recipient, subject, body, message_id=message_id, in_reply_to=in_reply_to, references=references
    )
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


def _normalize_subject(subject):
    if not subject:
        return ""
    text = subject.strip().lower()
    while True:
        new_text = re.sub(r"^(re|fwd|fw|aw|sv|vs)\s*:\s*", "", text, flags=re.IGNORECASE).strip()
        if new_text == text:
            break
        text = new_text
    return text


def _clean_reply_body(text):
    if not text:
        return ""
    raw_text = text.strip()
    if not raw_text:
        return ""

    lines = raw_text.splitlines()
    cut_idx = None

    quote_header_re = re.compile(
        r"^\s*(On\s+.+?wrote:|At\s+.+?wrote:|Le\s+.+?écrit\s*:|El\s+.+?escribió\s*:|Am\s+.+?schrieb\s*:)\s*$",
        re.IGNORECASE,
    )
    orig_msg_re = re.compile(
        r"^\s*[-_]{3,}\s*(Original Message|Forwarded Message|Forwarded message)\s*[-_]{3,}\s*$",
        re.IGNORECASE,
    )
    divider_re = re.compile(r"^\s*_{10,}\s*$")
    from_header_re = re.compile(r"^\s*From:\s+", re.IGNORECASE)

    for i, line in enumerate(lines):
        trimmed = line.strip()
        if not trimmed:
            continue

        if quote_header_re.match(trimmed):
            cut_idx = i
            break

        if re.match(r"^\s*On\s+", trimmed, re.IGNORECASE):
            joined_lookahead = " ".join(l.strip() for l in lines[i:i+3])
            if re.search(r"wrote:\s*$", joined_lookahead, re.IGNORECASE):
                cut_idx = i
                break

        if orig_msg_re.match(trimmed) or divider_re.match(trimmed):
            cut_idx = i
            break

        if from_header_re.match(trimmed):
            next_lines = " ".join(lines[i+1:i+4])
            if re.search(r"(Sent:|Date:|To:|Subject:)", next_lines, re.IGNORECASE):
                cut_idx = i
                break

        if trimmed.startswith(">"):
            cut_idx = i
            break

    if cut_idx is not None:
        kept_lines = lines[:cut_idx]
    else:
        kept_lines = lines

    while kept_lines and (kept_lines[-1].strip().startswith(">") or not kept_lines[-1].strip()):
        kept_lines.pop()

    cleaned = "\n".join(kept_lines).strip()
    return cleaned if cleaned else raw_text


def _extract_external_id_or_fallback(parsed, mailbox, sender_email, recipient_email, subject, body):
    external_id = (parsed.get("Message-ID") or "").strip()
    if not external_id:
        date_header = (parsed.get("Date") or "").strip()
        norm_subj = _normalize_subject(subject)
        body_hash = hashlib.sha256(body.encode("utf-8", errors="replace")).hexdigest()[:16]
        mbox_id = str(mailbox.id if mailbox else "0")
        combined = f"{mbox_id}|{sender_email.lower()}|{recipient_email.lower()}|{norm_subj}|{date_header}|{body_hash}"
        fallback_hash = hashlib.sha256(combined.encode("utf-8")).hexdigest()
        domain = mailbox.email.split("@")[-1] if (mailbox and "@" in mailbox.email) else "annomous.com"
        external_id = f"<fallback-{fallback_hash}@{domain}>"
    return external_id


def _extract_header_message_ids(header_value):
    if not header_value:
        return []
    bracketed = re.findall(r"<[^>]+>", header_value)
    if bracketed:
        return [m.strip() for m in bracketed if m.strip()]
    tokens = [t.strip() for t in header_value.split() if t.strip()]
    return tokens


def _find_matching_ticket(mailbox, parsed, sender_email, subject):
    in_reply_to_header = parsed.get("In-Reply-To", "")
    references_header = parsed.get("References", "")
    candidate_ids = []

    for msg_id in _extract_header_message_ids(in_reply_to_header):
        if msg_id not in candidate_ids:
            candidate_ids.append(msg_id)

    for msg_id in _extract_header_message_ids(references_header):
        if msg_id not in candidate_ids:
            candidate_ids.append(msg_id)

    for msg_id in candidate_ids:
        matching_msg = SupportMessage.objects.filter(external_message_id=msg_id).select_related("ticket").first()
        if matching_msg and matching_msg.ticket:
            return matching_msg.ticket
        matching_ticket = SupportTicket.objects.filter(external_message_id=msg_id).first()
        if matching_ticket:
            return matching_ticket

    norm_subj = _normalize_subject(subject)
    if norm_subj and sender_email and mailbox:
        candidates = (
            SupportTicket.objects.filter(
                mailbox=mailbox,
                email__iexact=sender_email.strip(),
            )
            .exclude(status=SupportTicket.Status.CLOSED)
            .order_by("-last_message_at", "-created_at")
        )
        for cand in candidates:
            if _normalize_subject(cand.subject) == norm_subj:
                return cand

    return None


def _import_message(mailbox, raw):
    parsed = email.message_from_bytes(raw)
    sender_name, sender_email = parseaddr(parsed.get("From", ""))
    _, recipient_email = parseaddr(parsed.get("To", ""))
    recipient_email = recipient_email or mailbox.email
    subject = _decode(parsed.get("Subject", "")) or "Support email"
    body = _plain_body(parsed).strip() or "(No plain-text body.)"
    external_id = _extract_external_id_or_fallback(parsed, mailbox, sender_email, recipient_email, subject, body)

    # Handle platform support notifications before generic Message-ID
    # deduplication.
    if _is_internal_support_notification(parsed):
        return _link_support_notification(mailbox, parsed, external_id)

    if external_id and (
        SupportMessage.objects.filter(external_message_id=external_id).exists()
        or SupportTicket.objects.filter(external_message_id=external_id).exists()
    ):
        return False

    cleaned_body = _clean_reply_body(body)
    ticket = _find_matching_ticket(mailbox, parsed, sender_email, subject)

    if ticket is not None:
        SupportMessage.objects.create(
            ticket=ticket,
            direction=SupportMessage.Direction.INBOUND,
            sender_name=_decode(sender_name) or sender_email or ticket.name,
            sender_email=(sender_email or mailbox.email).lower(),
            recipient_email=mailbox.email,
            subject=subject[:180],
            body=cleaned_body,
            external_message_id=external_id,
        )
        ticket.status = SupportTicket.Status.OPEN
        ticket.last_message_at = timezone.now()
        ticket.save(update_fields=("status", "last_message_at", "updated_at"))
        return True

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
        body=cleaned_body,
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
