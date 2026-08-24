from .common import *  # noqa: F401,F403
from .common import _checkout_cookie_samesite, _cookie_name

class InvoiceCreateView(CsrfProtectedAPIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_signup"

    def post(self, request):
        serializer = InvoiceCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = cast(dict[str, Any], serializer.validated_data or {})
        if not consume_precheckout_session(request, validated_data["email"]):
            existing = None
            idempotency_key = (validated_data.get("idempotency_key", "") or "").strip()[:96]
            if idempotency_key:
                existing = PaymentInvoice.objects.filter(
                    normalized_customer_email=validated_data["email"],
                    idempotency_key=idempotency_key,
                    status__in=(PaymentInvoice.Status.PENDING, PaymentInvoice.Status.VERIFYING, PaymentInvoice.Status.EXPIRED),
                ).order_by("-created_at").first()
            if not existing:
                from ..services import normalized_org_name

                existing = PaymentInvoice.objects.filter(
                    normalized_customer_email=validated_data["email"],
                    normalized_organization_name=normalized_org_name(validated_data["organization_name"]),
                    status__in=(PaymentInvoice.Status.PENDING, PaymentInvoice.Status.VERIFYING),
                    expires_at__gt=timezone.now(),
                ).order_by("-created_at").first()
            if not existing or not authorize_checkout_session(request, existing):
                return Response({"detail": "Verify your email before creating a paid invoice."}, status=403)
        invoice, token, created = serializer.save()
        data = dict(InvoiceSerializer(invoice).data)
        response = Response(data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
        response.delete_cookie(
            _cookie_name(settings.PRECHECKOUT_SESSION_COOKIE_NAME),
            path="/",
            samesite=_checkout_cookie_samesite(),
        )
        return _set_checkout_cookie(response, token)


class CustomInvoiceCreateView(CsrfProtectedAPIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_signup"

    def post(self, request):
        serializer = CustomInvoiceCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = cast(dict[str, Any], serializer.validated_data or {})
        if not consume_precheckout_session(request, validated_data["email"]):
            existing = None
            idempotency_key = (validated_data.get("idempotency_key", "") or "").strip()[:96]
            if idempotency_key:
                existing = PaymentInvoice.objects.filter(
                    normalized_customer_email=validated_data["email"],
                    idempotency_key=idempotency_key,
                    status__in=(PaymentInvoice.Status.PENDING, PaymentInvoice.Status.VERIFYING, PaymentInvoice.Status.EXPIRED),
                ).order_by("-created_at").first()
            if not existing:
                from ..services import normalized_org_name

                existing = PaymentInvoice.objects.filter(
                    normalized_customer_email=validated_data["email"],
                    normalized_organization_name=normalized_org_name(validated_data["organization_name"]),
                    status__in=(PaymentInvoice.Status.PENDING, PaymentInvoice.Status.VERIFYING),
                    expires_at__gt=timezone.now(),
                ).order_by("-created_at").first()
            if not existing or not authorize_checkout_session(request, existing):
                return Response({"detail": "Verify your email before creating a paid invoice."}, status=403)
        invoice, token, created = serializer.save()
        data = dict(InvoiceSerializer(invoice).data)
        response = Response(data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
        response.delete_cookie(
            _cookie_name(settings.PRECHECKOUT_SESSION_COOKIE_NAME),
            path="/",
            samesite=_checkout_cookie_samesite(),
        )
        return _set_checkout_cookie(response, token)


class AccountInvoiceCreateView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_signup"

    def post(self, request):
        if request.user.role != "admin" or not request.user.organization_id:
            return Response({"detail": "Only an organization administrator can change its subscription."}, status=403)
        serializer = AccountInvoiceCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        invoice, token, created = serializer.save()
        data = InvoiceSerializer(invoice).data
        return _set_checkout_cookie(
            Response(data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK),
            token,
        )


class AccountCustomInvoiceCreateView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_signup"

    def post(self, request):
        if request.user.role != "admin" or not request.user.organization_id:
            return Response({"detail": "Only an organization administrator can change its subscription."}, status=403)
        serializer = AccountCustomInvoiceCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        invoice, token, created = serializer.save()
        return _set_checkout_cookie(
            Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK),
            token,
        )


def _is_org_admin_for_invoice(request, invoice):
    user = request.user
    return (
        user
        and user.is_authenticated
        and getattr(user, "role", None) == "admin"
        and invoice.organization_id
        and invoice.organization_id == getattr(user, "organization_id", None)
    )


def _authorize_invoice_request(request, invoice):
    if _is_org_admin_for_invoice(request, invoice):
        return None
    if authorize_checkout_session(request, invoice):
        return None
    return Response({"detail": "Invoice access is unauthorized."}, status=401)


def _set_checkout_cookie(response, token):
    response.set_cookie(
        key=_cookie_name(settings.CHECKOUT_SESSION_COOKIE_NAME),
        value=token,
        max_age=12 * 60 * 60,
        secure=settings.CHECKOUT_SESSION_COOKIE_SECURE,
        httponly=True,
        samesite=_checkout_cookie_samesite(),
        path="/",
    )
    return response


def _invoice_response(invoice, token=None, response_status=200):
    data = dict(InvoiceSerializer(invoice).data)
    if token:
        data.update(serialize_invoice_access(invoice, token))
    return Response(data, status=response_status)


def _expire_if_needed(invoice):
    if invoice.status == PaymentInvoice.Status.PENDING and invoice.expires_at <= timezone.now():
        invoice.status = PaymentInvoice.Status.EXPIRED
        invoice.password_hash = ""
        invoice.save(update_fields=("status", "password_hash", "updated_at"))
        from ..services import revoke_invoice_access

        revoke_invoice_access(invoice)
    return invoice


def _transfer_was_after_expiry(invoice, transfer):
    if not getattr(transfer, "occurred_at", None):
        raise DRFValidationError({"detail": "The transfer timestamp could not be trusted."})
    return transfer.occurred_at > invoice.expires_at


def _mark_manual_review(invoice, transfer):
    invoice.transaction_hash = transfer.transaction_hash
    invoice.transfer_index = transfer.transfer_index
    invoice.verification_data = transfer.raw
    invoice.verification_error = "Payment was sent after the quote expired and needs manual review."
    invoice.password_hash = ""
    invoice.status = PaymentInvoice.Status.MANUAL_REVIEW
    invoice.save(update_fields=(
        "transaction_hash", "transfer_index", "verification_data", "verification_error",
        "password_hash", "status", "updated_at",
    ))
    from ..tasks import send_manual_review_email

    transaction.on_commit(lambda: cast(Any, send_manual_review_email).delay(str(invoice.pk)))
    return invoice


class InvoiceDetailView(APIView):
    permission_classes = [AllowAny]

    def get_object(self, invoice_id):
        return PaymentInvoice.objects.select_related("plan").get(pk=invoice_id)

    def get(self, request, invoice_id):
        try:
            invoice = self.get_object(invoice_id)
        except (PaymentInvoice.DoesNotExist, ValueError):
            return Response({"detail": "Invoice not found."}, status=404)
        invoice = _expire_if_needed(invoice)
        has_session = authorize_checkout_session(request, invoice)
        response = _invoice_response(invoice)
        if not has_session and not _is_org_admin_for_invoice(request, invoice):
            session_token = create_checkout_session(invoice)
            response = _set_checkout_cookie(response, session_token)
        return response


class CurrentInvoiceView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        token = request.COOKIES.get(_cookie_name(settings.CHECKOUT_SESSION_COOKIE_NAME), "")
        if not token:
            return Response({"detail": "Invoice access is unauthorized."}, status=401)
        from ..services import invoice_token_digest
        from ..models import CheckoutSession

        session = CheckoutSession.objects.select_related("invoice", "invoice__plan").filter(
            token_digest=invoice_token_digest(token),
            revoked_at__isnull=True,
            expires_at__gt=timezone.now(),
        ).order_by("-created_at").first()
        if not session:
            return Response({"detail": "Invoice access is unauthorized."}, status=401)
        session.last_used_at = timezone.now()
        session.save(update_fields=("last_used_at",))
        invoice = _expire_if_needed(session.invoice)
        return _invoice_response(invoice)


class InvoiceSessionExchangeView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "invoice_recover"

    def post(self, request, invoice_id):
        code = (request.data.get("code") or "").strip()
        if not code:
            return Response({"detail": "Invoice access is unauthorized."}, status=401)
        try:
            invoice, session_token = exchange_invoice_code(invoice_id, code, request=request)
        except PaymentInvoice.DoesNotExist:
            return Response({"detail": "Invoice not found."}, status=404)
        except DRFValidationError as exc:
            return Response(exc.detail, status=401)
        response = _invoice_response(_expire_if_needed(invoice))
        return _set_checkout_cookie(response, session_token)


class InvoiceVerifyView(CsrfProtectedAPIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "payment_verify"

    def post(self, request, invoice_id):
        submission = TransactionSubmissionSerializer(data=request.data)
        submission.is_valid(raise_exception=True)
        validated_submission = cast(dict[str, Any], submission.validated_data or {})
        restore_status = PaymentInvoice.Status.PENDING
        try:
            with transaction.atomic():
                invoice = PaymentInvoice.objects.select_for_update(of=("self",)).select_related("plan").get(pk=invoice_id)
                auth_result = _authorize_invoice_request(request, invoice)
                if isinstance(auth_result, Response):
                    return auth_result
                if invoice.status == PaymentInvoice.Status.PAID:
                    return Response(InvoiceSerializer(invoice).data)
                invoice = _expire_if_needed(invoice)
                restore_status = (
                    PaymentInvoice.Status.EXPIRED
                    if invoice.status == PaymentInvoice.Status.EXPIRED
                    else PaymentInvoice.Status.PENDING
                )
                if invoice.status not in {PaymentInvoice.Status.PENDING, PaymentInvoice.Status.VERIFYING, PaymentInvoice.Status.EXPIRED}:
                    return Response({"detail": "This invoice cannot be verified."}, status=400)
                invoice.status = PaymentInvoice.Status.VERIFYING
                invoice.verification_error = ""
                invoice.save(update_fields=("status", "verification_error", "updated_at"))
            transfer = verify_invoice_transfer(invoice, validated_submission["transaction"])
            if _transfer_was_after_expiry(invoice, transfer):
                with transaction.atomic():
                    invoice = PaymentInvoice.objects.select_for_update(of=("self",)).get(pk=invoice_id)
                    record_review_claim(invoice, transfer, "late_payment")
                    invoice = _mark_manual_review(invoice, transfer)
                return Response(InvoiceSerializer(invoice).data, status=202)
            invoice = fulfill_paid_invoice(invoice.pk, transfer)
            if invoice.status == PaymentInvoice.Status.MANUAL_REVIEW:
                return Response(InvoiceSerializer(invoice).data, status=202)
            return Response(InvoiceSerializer(invoice).data)
        except PaymentInvoice.DoesNotExist:
            return Response({"detail": "Invoice not found."}, status=404)
        except VerificationError as exc:
            PaymentInvoice.objects.filter(pk=invoice_id, status=PaymentInvoice.Status.VERIFYING).update(
                status=restore_status, verification_error=str(exc)
            )
            return Response({"detail": str(exc)}, status=400)
        except DRFValidationError:
            review_invoice = PaymentInvoice.objects.filter(pk=invoice_id, status=PaymentInvoice.Status.MANUAL_REVIEW).first()
            if review_invoice:
                return Response(InvoiceSerializer(review_invoice).data, status=202)
            PaymentInvoice.objects.filter(pk=invoice_id, status=PaymentInvoice.Status.VERIFYING).update(status=restore_status)
            raise


class InvoiceRecoverView(CsrfProtectedAPIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "invoice_recover"

    def post(self, request):
        serializer = InvoiceRecoverSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from ..tasks import send_recovery_email

        validated_data = cast(dict[str, Any], serializer.validated_data or {})
        cast(Any, send_recovery_email).delay(validated_data["email"])
        return Response({"detail": "If an active invoice exists for that email, a secure link will be sent shortly."}, status=202)


class InvoiceReplaceView(CsrfProtectedAPIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_signup"

    def post(self, request, invoice_id):
        try:
            invoice = PaymentInvoice.objects.select_related("plan").get(pk=invoice_id)
        except PaymentInvoice.DoesNotExist:
            return Response({"detail": "Invoice not found."}, status=404)
        auth_result = _authorize_invoice_request(request, invoice)
        if isinstance(auth_result, Response):
            return auth_result
        serializer = InvoiceReplaceSerializer(data=request.data, context={"invoice": invoice})
        serializer.is_valid(raise_exception=True)
        validated_data = cast(dict[str, Any], serializer.validated_data or {})
        new_invoice, token = replace_invoice(invoice, validated_data["password_hash"])
        return _set_checkout_cookie(_invoice_response(new_invoice, response_status=201), token)


class InvoiceCancelView(CsrfProtectedAPIView):
    permission_classes = [AllowAny]

    def post(self, request, invoice_id):
        try:
            invoice = PaymentInvoice.objects.get(pk=invoice_id)
        except PaymentInvoice.DoesNotExist:
            return Response({"detail": "Invoice not found."}, status=404)
        auth_result = _authorize_invoice_request(request, invoice)
        if isinstance(auth_result, Response):
            return auth_result
        return Response(InvoiceSerializer(cancel_invoice(invoice)).data)



