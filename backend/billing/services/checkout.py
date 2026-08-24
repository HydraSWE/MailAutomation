from .common import *  # noqa: F401,F403
from .turnstile import verify_turnstile

def send_checkout_otp(email, code):
    relay_url = getattr(settings, "MAIL_FLOW_OTP_RELAY_URL", "")
    relay_secret = getattr(settings, "MAIL_FLOW_OTP_RELAY_SECRET", "")
    if relay_url and relay_secret:
        timestamp = str(int(time.time()))
        body = {
            "email": email,
            "code": code,
            "timestamp": timestamp,
        }
        signed_payload = json.dumps(body, separators=(",", ":"), sort_keys=True)
        signature = hmac.new(relay_secret.encode(), signed_payload.encode(), hashlib.sha256).hexdigest()
        response = requests.post(
            relay_url,
            json=body,
            headers={
                "X-Mail-Flow-Signature": signature,
                "X-Mail-Flow-Timestamp": timestamp,
            },
            timeout=getattr(settings, "MAIL_FLOW_OTP_RELAY_TIMEOUT", 10),
        )
        response.raise_for_status()
        return

    send_mail(
        "Verify your Mail Flow checkout",
        f"Your Mail Flow checkout code is {code}. It expires in 10 minutes.",
        settings.DEFAULT_FROM_EMAIL,
        [email],
        fail_silently=False,
    )


@transaction.atomic
def start_checkout_email_verification(email, turnstile_token, *, request=None):
    verify_turnstile(turnstile_token, request)
    email = normalized_email(email)
    check_account_available_for_signup(email)
    code = f"{secrets.randbelow(1_000_000):06d}"
    CheckoutEmailVerification.objects.filter(
        normalized_email=email, used_at__isnull=True, expires_at__gt=timezone.now(),
    ).update(used_at=timezone.now())
    CheckoutEmailVerification.objects.create(
        normalized_email=email,
        email=email,
        code_digest=private_hash(code),
        expires_at=timezone.now() + timedelta(minutes=10),
    )
    from ..tasks import send_checkout_otp_email

    transaction.on_commit(lambda: cast(Any, send_checkout_otp_email).delay(email, code))
    audit_event("checkout_email_otp_started", request=request, metadata={"email_hash": private_hash(email)})


@transaction.atomic
def verify_checkout_email(email, code, *, request=None):
    email = normalized_email(email)
    challenge = CheckoutEmailVerification.objects.select_for_update().filter(
        normalized_email=email,
        used_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).order_by("-created_at").first()
    if not challenge:
        raise ValidationError({"detail": "The verification code is invalid or expired."})
    if challenge.attempts >= 5:
        challenge.used_at = timezone.now()
        challenge.save(update_fields=("used_at",))
        raise ValidationError({"detail": "The verification code is invalid or expired."})
    challenge.attempts += 1
    if private_hash(code) != challenge.code_digest:
        challenge.save(update_fields=("attempts",))
        raise ValidationError({"detail": "The verification code is invalid or expired."})
    challenge.used_at = timezone.now()
    challenge.save(update_fields=("attempts", "used_at"))
    token = secrets.token_urlsafe(32)
    PreCheckoutSession.objects.filter(normalized_email=email, revoked_at__isnull=True).update(revoked_at=timezone.now())
    PreCheckoutSession.objects.create(
        normalized_email=email,
        token_digest=invoice_token_digest(token),
        expires_at=timezone.now() + timedelta(minutes=20),
    )
    audit_event("checkout_email_otp_verified", request=request, metadata={"email_hash": private_hash(email)})
    return token


def authorize_precheckout_session(request, email):
    token = request.COOKIES.get(checkout_cookie_name(settings.PRECHECKOUT_SESSION_COOKIE_NAME), "")
    if not token:
        return False
    return PreCheckoutSession.objects.filter(
        normalized_email=normalized_email(email),
        token_digest=invoice_token_digest(token),
        revoked_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).exists()


def consume_precheckout_session(request, email):
    token = request.COOKIES.get(checkout_cookie_name(settings.PRECHECKOUT_SESSION_COOKIE_NAME), "")
    if not token:
        return False
    updated = PreCheckoutSession.objects.select_for_update().filter(
        normalized_email=normalized_email(email),
        token_digest=invoice_token_digest(token),
        revoked_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).update(revoked_at=timezone.now())
    return bool(updated)



