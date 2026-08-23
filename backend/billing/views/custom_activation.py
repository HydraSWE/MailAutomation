from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from ..serializers import (
    CustomActivationCompleteSerializer,
    CustomActivationStartSerializer,
    CustomActivationVerifyOtpSerializer,
)
from ..services.custom_activation import (
    _mask_email,
    complete_custom_activation,
    get_pending_paid_quotes_for_session,
    request_activation_otp,
    validate_activation_intent,
    validate_setup_session,
    verify_activation_otp,
)
from .common import CsrfProtectedAPIView


class CustomActivationStartView(CsrfProtectedAPIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "otp_verify"

    def post(self, request):
        serializer = CustomActivationStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        quote = validate_activation_intent(serializer.validated_data["token"])
        return Response({
            "quote_id": str(quote.id),
            "quote_number": quote.quote_number,
            "organization_name": quote.organization_name,
            "customer_name": quote.customer_name,
            "masked_email": _mask_email(quote.customer_email),
            "approved_limits": quote.approved_limits or quote.requested_limits,
        }, status=status.HTTP_200_OK)


class CustomActivationRequestOtpView(CsrfProtectedAPIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "checkout_email"

    def post(self, request):
        serializer = CustomActivationStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        verification, _ = request_activation_otp(
            raw_token=serializer.validated_data["token"],
            request=request,
        )
        return Response({
            "verification_id": str(verification.id),
            "masked_email": _mask_email(verification.email),
            "expires_at": verification.expires_at.isoformat(),
            "detail": "Activation verification code sent to your registered work email.",
        }, status=status.HTTP_200_OK)


class CustomActivationVerifyOtpView(CsrfProtectedAPIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "otp_verify"

    def post(self, request):
        serializer = CustomActivationVerifyOtpSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session, raw_session_token = verify_activation_otp(
            raw_token=serializer.validated_data["token"],
            otp_code=serializer.validated_data["otp"],
        )
        return Response({
            "session_token": raw_session_token,
            "expires_at": session.expires_at.isoformat(),
            "detail": "Email ownership confirmed.",
        }, status=status.HTTP_200_OK)


class CustomActivationPendingOrgsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        session_token = (
            request.headers.get("X-Setup-Session")
            or request.query_params.get("session_token")
            or ""
        ).strip()
        pending_quotes = get_pending_paid_quotes_for_session(session_token)
        return Response({
            "results": pending_quotes,
            "count": len(pending_quotes),
        }, status=status.HTTP_200_OK)


class CustomActivationCompleteView(CsrfProtectedAPIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_signup"

    def post(self, request):
        serializer = CustomActivationCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        organization, user, auth_data = complete_custom_activation(
            session_token=serializer.validated_data["session_token"],
            quote_id=str(serializer.validated_data["quote_id"]),
            password=serializer.validated_data["password"],
            username=serializer.validated_data.get("username"),
            name=serializer.validated_data.get("name"),
            request=request,
        )

        return Response({
            **auth_data,
            "detail": f"Workspace '{organization.name}' provisioned successfully.",
        }, status=status.HTTP_201_CREATED)
