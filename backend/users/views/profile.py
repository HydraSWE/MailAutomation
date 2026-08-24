from .common import *  # noqa: F401,F403
from .common import _request_user

class SettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def _setting(self, request):
        user = _request_user(request)
        if user.organization:
            return SystemSetting.objects.get_or_create(organization=user.organization)[0]
        # Owner-managed platform settings must never fall back to an
        # organization's configuration.
        setting = SystemSetting.objects.filter(organization__isnull=True).first()
        return setting or SystemSetting.objects.create(organization=None)

    def get(self, request):
        setting_obj = self._setting(request)
        if not setting_obj:
            return Response({"detail": "System settings not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(SystemSettingSerializer(setting_obj).data)

    def patch(self, request):
        user = _request_user(request)
        if user.role not in {"owner", "admin"}:
            return Response({"detail": "You do not have permission to change settings."}, status=status.HTTP_403_FORBIDDEN)
        setting_obj = self._setting(request)
        if not setting_obj:
            return Response({"detail": "System settings not found."}, status=status.HTTP_404_NOT_FOUND)
        data = request.data.copy()
        if user.role != "owner":
            data.pop("app_name", None)
        serializer = SystemSettingSerializer(setting_obj, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(ProfileSerializer(_request_user(request)).data)

    def patch(self, request):
        serializer = ProfileSerializer(_request_user(request), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_change"

    def post(self, request):
        user = _request_user(request)
        if not user.check_password(request.data.get("current_password")):
            return Response({"detail": "Current password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError
        try:
            validate_password(request.data.get("new_password"), user=user)
        except ValidationError as exc:
            return Response({"detail": list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(request.data["new_password"])
        user.save(update_fields=["password"])
        UserLoginSession.objects.filter(user=user, revoked_at__isnull=True).update(revoked_at=timezone.now())
        return Response({"detail": "Password updated. Please sign in again."})


class RequestEmailChangeView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_change"

    def post(self, request):
        import hashlib
        import secrets
        from datetime import timedelta
        from django.db import transaction

        serializer = RequestEmailChangeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        user = _request_user(request)
        new_email = serializer.validated_data["new_email"]

        raw_otp = f"{secrets.randbelow(1_000_000):06d}"
        code_digest = hashlib.sha256(raw_otp.encode()).hexdigest()

        # Invalidate previous unconsumed email change requests for this user
        EmailChangeRequest.objects.filter(
            user=user,
            consumed_at__isnull=True,
        ).update(consumed_at=timezone.now())

        change_request = EmailChangeRequest.objects.create(
            user=user,
            new_email=new_email,
            code_digest=code_digest,
            expires_at=timezone.now() + timedelta(minutes=10),
        )

        from billing.tasks import send_email_change_otp_email

        transaction.on_commit(lambda: send_email_change_otp_email.delay(new_email, raw_otp))

        return Response({
            "request_id": str(change_request.id),
            "new_email": new_email,
            "expires_at": change_request.expires_at.isoformat(),
            "detail": "Verification code has been sent to your new email address.",
        })


class ConfirmEmailChangeView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_change"

    def post(self, request):
        import hashlib
        serializer = ConfirmEmailChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = _request_user(request)
        request_id = serializer.validated_data["request_id"]
        code = serializer.validated_data["code"]

        try:
            change_request = EmailChangeRequest.objects.get(
                pk=request_id,
                user=user,
                consumed_at__isnull=True,
            )
        except (EmailChangeRequest.DoesNotExist, ValueError):
            return Response(
                {"detail": "This verification request has expired or does not exist. Please try again."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if change_request.expires_at <= timezone.now():
            return Response(
                {"detail": "This verification code has expired. Please request a new code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if change_request.attempts >= change_request.max_attempts:
            return Response(
                {"detail": "Maximum verification attempts exceeded. Please request a new code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        change_request.attempts += 1
        change_request.save(update_fields=["attempts"])

        expected_digest = hashlib.sha256(code.encode()).hexdigest()
        if change_request.code_digest != expected_digest:
            remaining = max(0, change_request.max_attempts - change_request.attempts)
            return Response(
                {"detail": f"Invalid verification code. {remaining} attempts remaining."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(email__iexact=change_request.new_email).exclude(pk=user.pk).exists():
            return Response(
                {"detail": "An account with this email address already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        old_email = user.email
        user.email = change_request.new_email
        update_fields = ["email"]
        if user.username == old_email or "@" in user.username:
            user.username = change_request.new_email
            update_fields.append("username")

        user.save(update_fields=update_fields)
        change_request.consumed_at = timezone.now()
        change_request.save(update_fields=["consumed_at"])

        return Response({
            "detail": "Email address updated successfully.",
            "profile": ProfileSerializer(user).data,
        })


