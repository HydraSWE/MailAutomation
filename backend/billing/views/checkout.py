from .common import *  # noqa: F401,F403
from .common import _checkout_cookie_samesite, _cookie_name

class FreeSignupView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_signup"

    def post(self, request):
        serializer = FreeSignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        organization, user = provision_free_account(serializer.validated_data, request)

        from rest_framework_simplejwt.tokens import RefreshToken
        from users.models import UserLoginSession
        from users.serializers import UserSerializer, _request_ip
        import uuid

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
            ip_address=_request_ip(request),
            user_agent=(request.META.get("HTTP_USER_AGENT", "")[:1000] if request else ""),
        )

        response = Response({
            "detail": "Your free account is ready.",
            "user": UserSerializer(user).data,
            "organization_id": organization.pk,
            "email": user.email,
            "login_url": "/login",
        }, status=status.HTTP_201_CREATED)
        from users.auth_cookies import set_auth_cookies
        return set_auth_cookies(request, response, str(refresh.access_token), str(refresh))


class CheckoutEmailStartView(CsrfProtectedAPIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "checkout_email"

    def post(self, request):
        serializer = CheckoutEmailStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = cast(dict[str, Any], serializer.validated_data or {})
        start_checkout_email_verification(
            validated_data["email"],
            validated_data.get("turnstile_token", ""),
            request=request,
        )
        return Response({"detail": "If the address can continue, a verification code will be sent shortly."}, status=202)


class CheckoutEmailVerifyView(CsrfProtectedAPIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "checkout_email"

    def post(self, request):
        serializer = CheckoutEmailVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = cast(dict[str, Any], serializer.validated_data or {})
        token = verify_checkout_email(
            validated_data["email"],
            validated_data["code"],
            request=request,
        )
        response = Response({"detail": "Email verified."}, status=202)
        response.set_cookie(
            key=_cookie_name(settings.PRECHECKOUT_SESSION_COOKIE_NAME),
            value=token,
            max_age=20 * 60,
            secure=settings.CHECKOUT_SESSION_COOKIE_SECURE,
            httponly=True,
            samesite=_checkout_cookie_samesite(),
            path="/",
        )
        return response



