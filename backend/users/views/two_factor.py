from .common import *  # noqa: F401,F403
from .common import _request_user, _set_auth_cookies

def _request_ip_raw(request):
    ip = get_client_ip(request)
    return ip if ip != "unknown" else None


class TwoFactorSetupView(APIView):
    """Generate a TOTP secret + QR code for the authenticated user."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = _request_user(request)
        if user.two_factor_enabled:
            return Response(
                {"detail": "2FA is already enabled on your account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        secret = generate_totp_secret()
        uri = get_totp_uri(user, secret)
        qr_code = generate_qr_code_base64(uri)
        return Response({
            "secret": secret,
            "otpauth_uri": uri,
            "qr_code": qr_code,
        })


class TwoFactorConfirmView(APIView):
    """Confirm TOTP setup by verifying a test code, then activate 2FA."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = _request_user(request)
        secret = request.data.get("secret", "")
        code = request.data.get("code", "")
        if not secret or not code:
            return Response(
                {"detail": "Both secret and code are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not verify_totp(secret, code):
            return Response(
                {"detail": "Invalid verification code. Please try again."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Generate backup codes
        plain_codes, hashed_codes = generate_backup_codes()
        user.two_factor_secret = secret
        user.two_factor_enabled = True
        user.two_factor_backup_codes = hashed_codes
        user.save(update_fields=["two_factor_secret", "two_factor_enabled", "two_factor_backup_codes"])
        return Response({
            "detail": "Two-factor authentication has been enabled.",
            "backup_codes": plain_codes,
        })


class TwoFactorDisableView(APIView):
    """Disable 2FA after verifying current password."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = _request_user(request)
        password = request.data.get("password", "")
        if not password:
            return Response(
                {"detail": "Current password is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not user.check_password(password):
            return Response(
                {"detail": "Incorrect password."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.two_factor_enabled = False
        user.two_factor_secret = ""
        user.two_factor_backup_codes = []
        user.save(update_fields=["two_factor_enabled", "two_factor_secret", "two_factor_backup_codes"])
        return Response({"detail": "Two-factor authentication has been disabled."})


class TwoFactorBackupCodesView(APIView):
    """Regenerate backup recovery codes."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = _request_user(request)
        password = request.data.get("password", "")
        if not password:
            return Response(
                {"detail": "Current password is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not user.check_password(password):
            return Response(
                {"detail": "Incorrect password."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not user.two_factor_enabled:
            return Response(
                {"detail": "2FA is not enabled on your account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        plain_codes, hashed_codes = generate_backup_codes()
        user.two_factor_backup_codes = hashed_codes
        user.save(update_fields=["two_factor_backup_codes"])
        return Response({
            "detail": "Backup codes have been regenerated.",
            "backup_codes": plain_codes,
        })


class TwoFactorVerifyLoginView(APIView):
    """Public endpoint to complete 2FA login with a TOTP or backup code."""
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        challenge_token = request.data.get("challenge_token", "")
        code = request.data.get("code", "").strip()
        if not challenge_token or not code:
            return Response(
                {"detail": "Challenge token and verification code are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = verify_challenge_token(challenge_token)
        if not user:
            return Response(
                {"detail": "Challenge expired or invalid. Please sign in again."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Try TOTP first, then backup code
        valid = False
        if len(code) == 6 and code.isdigit():
            valid = verify_totp(user.two_factor_secret, code)
        if not valid:
            valid = verify_and_consume_backup_code(user, code)
        if not valid:
            return Response(
                {"detail": "Invalid verification code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Issue full JWT tokens and create session
        if user.role == User.Role.OWNER:
            UserLoginSession.objects.filter(user=user, revoked_at__isnull=True).update(revoked_at=timezone.now())
        session_id = uuid.uuid4()
        refresh = RefreshToken.for_user(user)
        refresh["session_id"] = str(session_id)
        refresh["role"] = user.role
        refresh["organization_id"] = user.organization.id if user.organization else None
        refresh["username"] = user.username
        refresh["email"] = user.email
        UserLoginSession.objects.create(
            user=user,
            session_id=session_id,
            refresh_token_jti=str(refresh["jti"]),
            ip_address=_request_ip_raw(request),
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:1000],
        )
        response = Response({
            "user": UserSerializer(user).data,
        })
        return _set_auth_cookies(request, response, str(refresh.access_token), str(refresh))

