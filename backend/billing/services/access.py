from .common import *  # noqa: F401,F403

def _fernet():
    key = getattr(settings, "FIELD_ENCRYPTION_KEY", None)
    if not key:
        key = urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode()).digest()).decode()
    from cryptography.fernet import Fernet

    return Fernet(key.encode())


def _encrypt_token(token):
    fernet = _fernet()
    return fernet.encrypt(token.encode()).decode() if fernet else ""


def decrypt_invoice_token(invoice):
    if not invoice.encrypted_access_token:
        return None
    fernet = _fernet()
    if not fernet:
        return None
    try:
        return fernet.decrypt(invoice.encrypted_access_token.encode()).decode()
    except Exception:
        return None


def issue_invoice_token(invoice, *, save=True):
    token = secrets.token_urlsafe(32)
    invoice.access_token_digest = invoice_token_digest(token)
    invoice.encrypted_access_token = _encrypt_token(token)
    invoice.access_token_created_at = timezone.now()
    if save:
        invoice.save(update_fields=(
            "access_token_digest", "encrypted_access_token", "access_token_created_at", "updated_at",
        ))
    return token


def issue_invoice_access_code(invoice, *, revoke_existing=True):
    if revoke_existing:
        InvoiceAccessCode.objects.filter(
            invoice=invoice, used_at__isnull=True, revoked_at__isnull=True,
        ).update(revoked_at=timezone.now())
    code = secrets.token_urlsafe(32)
    InvoiceAccessCode.objects.create(
        invoice=invoice,
        code_digest=invoice_token_digest(code),
        encrypted_delivery_copy=_encrypt_token(code),
        expires_at=timezone.now() + timedelta(hours=12),
    )
    return code


def decrypt_invoice_access_code(access_code):
    if not access_code.encrypted_delivery_copy:
        return None
    fernet = _fernet()
    try:
        return fernet.decrypt(access_code.encrypted_delivery_copy.encode()).decode()
    except Exception:
        return None


def revoke_invoice_access(invoice):
    now = timezone.now()
    CheckoutSession.objects.filter(invoice=invoice, revoked_at__isnull=True).update(revoked_at=now)
    InvoiceAccessCode.objects.filter(invoice=invoice, used_at__isnull=True, revoked_at__isnull=True).update(revoked_at=now)


def invoice_resume_url(invoice, token=None):
    path = f"/payment/{invoice.pk}"
    frontend = getattr(settings, "FRONTEND_URL", "").rstrip("/")
    suffix = f"?code={quote(token)}" if token else ""
    return f"{frontend}{path}{suffix}" if frontend else f"{path}{suffix}"


def serialize_invoice_access(invoice, token=None):
    data = {
        "resume_url": invoice_resume_url(invoice, token),
        "email_delivery": {
            "invoice_sent_at": invoice.invoice_email_sent_at,
            "invoice_error": invoice.invoice_email_error,
            "recovery_sent_at": invoice.recovery_email_sent_at,
            "recovery_error": invoice.recovery_email_error,
        },
    }
    return data


def create_checkout_session(invoice):
    CheckoutSession.objects.filter(invoice=invoice, revoked_at__isnull=True).update(revoked_at=timezone.now())
    token = secrets.token_urlsafe(32)
    CheckoutSession.objects.create(
        invoice=invoice,
        token_digest=invoice_token_digest(token),
        expires_at=timezone.now() + timedelta(hours=12),
    )
    return token


@transaction.atomic
def exchange_invoice_code(invoice_id, code, *, request=None):
    invoice = PaymentInvoice.objects.select_for_update(of=("self",)).get(pk=invoice_id)
    if invoice.status not in {PaymentInvoice.Status.PENDING, PaymentInvoice.Status.VERIFYING, PaymentInvoice.Status.EXPIRED}:
        raise ValidationError({"detail": "This invoice can no longer be opened."})
    submitted_digest = invoice_token_digest(code)
    access_code = InvoiceAccessCode.objects.select_for_update().filter(
        invoice=invoice,
        revoked_at__isnull=True,
        expires_at__gt=timezone.now(),
        code_digest=submitted_digest,
    ).order_by("-created_at").first()
    if not access_code:
        audit_event("checkout_code_rejected", invoice=invoice, request=request)
        raise ValidationError({"detail": "Invoice access is unauthorized."})
    if not access_code.used_at:
        access_code.used_at = timezone.now()
        access_code.encrypted_delivery_copy = ""
        access_code.save(update_fields=("used_at", "encrypted_delivery_copy"))
    invoice.access_token_last_used_at = timezone.now()
    invoice.save(update_fields=("access_token_last_used_at", "updated_at"))
    session_token = create_checkout_session(invoice)
    audit_event("checkout_session_issued", invoice=invoice, request=request)
    return invoice, session_token


def authorize_checkout_session(request, invoice):
    token = request.COOKIES.get(checkout_cookie_name(settings.CHECKOUT_SESSION_COOKIE_NAME), "")
    if not token:
        return False
    session = CheckoutSession.objects.filter(
        invoice=invoice,
        token_digest=invoice_token_digest(token),
        revoked_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).first()
    if not session:
        return False
    session.last_used_at = timezone.now()
    session.save(update_fields=("last_used_at",))
    return True



