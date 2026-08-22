from .common import *  # noqa: F401,F403

def verify_turnstile(token, request):
    secret = getattr(settings, "TURNSTILE_SECRET_KEY", "")
    if not secret:
        if getattr(settings, "IS_PRODUCTION", False):
            raise ValidationError({"turnstile_token": "Checkout verification is not configured."})
        return True
    try:
        response = requests.post(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            data={"secret": secret, "response": token, "remoteip": client_ip(request)},
            timeout=8,
        )
        payload = response.json()
    except (requests.RequestException, ValueError) as exc:
        raise ValidationError({"turnstile_token": "Checkout verification is temporarily unavailable."}) from exc
    if not payload.get("success"):
        raise ValidationError({"turnstile_token": "Checkout verification failed."})
    expected_hostnames = [
        hostname.strip()
        for hostname in getattr(settings, "TURNSTILE_EXPECTED_HOSTNAME", "").split(",")
        if hostname.strip()
    ]
    if expected_hostnames and payload.get("hostname") not in expected_hostnames:
        raise ValidationError({"turnstile_token": "Checkout verification failed."})
    expected_action = getattr(settings, "TURNSTILE_CHECKOUT_ACTION", "")
    if expected_action and payload.get("action") != expected_action:
        raise ValidationError({"turnstile_token": "Checkout verification failed."})
    challenge_ts = payload.get("challenge_ts")
    if challenge_ts:
        from django.utils.dateparse import parse_datetime

        parsed = parse_datetime(challenge_ts)
        if not parsed or timezone.now() - parsed > timedelta(minutes=5):
            raise ValidationError({"turnstile_token": "Checkout verification expired."})
    return True



