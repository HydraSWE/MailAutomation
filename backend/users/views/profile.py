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

