from .common import *  # noqa: F401,F403
from .common import _clear_auth_cookies, _request_user, _set_auth_cookies

class CustomTokenObtainPairView(TokenObtainPairView):
    permission_classes = ()
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code < 400 and isinstance(response.data, dict) and response.data.get("access"):
            access = response.data.pop("access")
            refresh = response.data.pop("refresh", None)
            _set_auth_cookies(request, response, access, refresh)
        return response


class CustomTokenRefreshView(TokenRefreshView):
    permission_classes = ()
    serializer_class = SessionTokenRefreshSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request, *args, **kwargs):
        data = request.data.copy()
        if not data.get("refresh"):
            data["refresh"] = request.COOKIES.get(settings.AUTH_REFRESH_COOKIE_NAME, "")
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        payload = dict(serializer.validated_data)
        access = payload.pop("access")
        refresh = payload.pop("refresh", None)
        response = Response(payload)
        return _set_auth_cookies(request, response, access, refresh)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        session_id = request.auth.get("session_id") if request.auth else None
        user = _request_user(request)
        UserLoginSession.objects.filter(
            user=user, session_id=session_id, revoked_at__isnull=True
        ).update(revoked_at=timezone.now())
        return _clear_auth_cookies(Response({"detail": "Signed out."}))

