from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from ..serializers import (
    CustomPlanQuoteSerializer,
    CustomQuoteOtpRequestSerializer,
    CustomQuoteOtpVerifySerializer,
    CustomQuoteSubmitSerializer,
)
from ..services.custom_quotes import (
    request_quote_otp,
    submit_custom_quote,
    verify_quote_otp,
)
from .common import CsrfProtectedAPIView


class CustomQuoteOtpRequestView(CsrfProtectedAPIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "checkout_email"

    def post(self, request):
        serializer = CustomQuoteOtpRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        verification, _ = request_quote_otp(
            email=serializer.validated_data["email"],
            turnstile_token=serializer.validated_data.get("turnstile_token", ""),
            request=request,
        )
        return Response({
            "verification_id": str(verification.id),
            "email": verification.email,
            "expires_at": verification.expires_at.isoformat(),
            "detail": "Verification code has been sent to your email.",
        }, status=status.HTTP_200_OK)


class CustomQuoteOtpVerifyView(CsrfProtectedAPIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "otp_verify"

    def post(self, request):
        serializer = CustomQuoteOtpVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        verification = verify_quote_otp(
            verification_id=str(serializer.validated_data["verification_id"]),
            otp_code=serializer.validated_data["otp"],
        )
        return Response({
            "verification_id": str(verification.id),
            "verified": True,
            "email": verification.email,
            "detail": "Email verified successfully.",
        }, status=status.HTTP_200_OK)


class CustomQuoteSubmitView(CsrfProtectedAPIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_signup"

    def post(self, request):
        serializer = CustomQuoteSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        quote = submit_custom_quote(
            verification_id=str(serializer.validated_data["verification_id"]),
            customer_name=serializer.validated_data["customer_name"],
            organization_name=serializer.validated_data["organization_name"],
            requested_limits=serializer.validated_data["requested_limits"],
            notes=serializer.validated_data.get("notes", ""),
            request=request,
        )
        return Response(
            CustomPlanQuoteSerializer(quote).data,
            status=status.HTTP_201_CREATED,
        )
