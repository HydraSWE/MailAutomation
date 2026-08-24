from django.urls import path

from .views import (
    AccountCustomInvoiceCreateView, AccountCustomQuoteView, AccountInvoiceCreateView, BscTransactionInspectView,
    CheckoutEmailStartView, CheckoutEmailVerifyView, FreeSignupView,
    CsrfBootstrapView, CurrentInvoiceView, CustomInvoiceCreateView, InvoiceCancelView,
    InvoiceCreateView, InvoiceDetailView, InvoiceRecoverView, InvoiceReplaceView,
    InvoiceSessionExchangeView, InvoiceVerifyView,
    PaymentReviewViewSet, PlanAdminViewSet, PlanListView, PublicLandingMonitorView,
    CustomQuoteOtpRequestView, CustomQuoteOtpVerifyView, CustomQuoteSubmitView,
    OwnerCustomQuoteViewSet,
    PlatformLeadHunterLicensesView, PlatformLeadHunterActionView,
    CustomActivationStartView, CustomActivationRequestOtpView, CustomActivationVerifyOtpView,
    CustomActivationPendingOrgsView, CustomActivationCompleteView,
)

plan_admin_list = PlanAdminViewSet.as_view({"get": "list", "post": "create"})
plan_admin_detail = PlanAdminViewSet.as_view({"get": "retrieve", "put": "update", "patch": "partial_update"})
review_list = PaymentReviewViewSet.as_view({"get": "list"})
review_detail = PaymentReviewViewSet.as_view({"get": "retrieve"})
review_action = PaymentReviewViewSet.as_view({"post": "action"})

owner_quote_list = OwnerCustomQuoteViewSet.as_view({"get": "list"})
owner_quote_detail = OwnerCustomQuoteViewSet.as_view({"get": "retrieve"})
owner_quote_approve = OwnerCustomQuoteViewSet.as_view({"post": "approve_and_invoice"})
owner_quote_reject = OwnerCustomQuoteViewSet.as_view({"post": "reject"})
owner_quote_pay_approve = OwnerCustomQuoteViewSet.as_view({"post": "payment_review_approve"})
owner_quote_pay_reject = OwnerCustomQuoteViewSet.as_view({"post": "payment_review_reject"})

urlpatterns = [
    path("monitor/", PublicLandingMonitorView.as_view(), name="public-landing-monitor"),
    path("plans/", PlanListView.as_view(), name="public-plans"),
    path("platform/plans/", plan_admin_list, name="platform-plan-list"),
    path("platform/plans/<int:pk>/", plan_admin_detail, name="platform-plan-detail"),
    path("platform/payment-reviews/", review_list, name="platform-payment-review-list"),
    path("platform/payment-reviews/<int:pk>/", review_detail, name="platform-payment-review-detail"),
    path("platform/payment-reviews/<int:pk>/action/", review_action, name="platform-payment-review-action"),
    path("platform/bsc-transaction-inspect/", BscTransactionInspectView.as_view(), name="platform-bsc-transaction-inspect"),
    path("platform/lead-hunter/licenses/", PlatformLeadHunterLicensesView.as_view(), name="platform-lead-hunter-licenses"),
    path("platform/lead-hunter/licenses/<str:license_key>/action/", PlatformLeadHunterActionView.as_view(), name="platform-lead-hunter-action"),

    # Platform Owner Custom Quote Endpoints
    path("platform/custom-quotes/", owner_quote_list, name="platform-custom-quote-list"),
    path("platform/custom-quotes/<uuid:pk>/", owner_quote_detail, name="platform-custom-quote-detail"),
    path("platform/custom-quotes/<uuid:pk>/approve-and-invoice/", owner_quote_approve, name="platform-custom-quote-approve"),
    path("platform/custom-quotes/<uuid:pk>/reject/", owner_quote_reject, name="platform-custom-quote-reject"),
    path("platform/custom-quotes/<uuid:pk>/payment-review/approve/", owner_quote_pay_approve, name="platform-custom-quote-pay-approve"),
    path("platform/custom-quotes/<uuid:pk>/payment-review/reject/", owner_quote_pay_reject, name="platform-custom-quote-pay-reject"),

    # Public Custom Quote Submission Flow
    path("custom-quotes/request-otp/", CustomQuoteOtpRequestView.as_view(), name="custom-quote-request-otp"),
    path("custom-quotes/verify-otp/", CustomQuoteOtpVerifyView.as_view(), name="custom-quote-verify-otp"),
    path("custom-quotes/submit/", CustomQuoteSubmitView.as_view(), name="custom-quote-submit"),

    # Post-Payment Custom Activation Flow
    path("custom-quotes/activation/start/", CustomActivationStartView.as_view(), name="custom-activation-start"),
    path("custom-quotes/activation/request-otp/", CustomActivationRequestOtpView.as_view(), name="custom-activation-request-otp"),
    path("custom-quotes/activation/verify-otp/", CustomActivationVerifyOtpView.as_view(), name="custom-activation-verify-otp"),
    path("custom-quotes/activation/pending/", CustomActivationPendingOrgsView.as_view(), name="custom-activation-pending"),
    path("custom-quotes/activation/complete/", CustomActivationCompleteView.as_view(), name="custom-activation-complete"),

    # Standard Invoicing & Checkout Flow
    path("signup/free/", FreeSignupView.as_view(), name="free-signup"),
    path("checkout/email/start/", CheckoutEmailStartView.as_view(), name="checkout-email-start"),
    path("checkout/email/verify/", CheckoutEmailVerifyView.as_view(), name="checkout-email-verify"),
    path("csrf/", CsrfBootstrapView.as_view(), name="billing-csrf"),
    path("invoices/", InvoiceCreateView.as_view(), name="invoice-create"),
    path("custom-invoices/", CustomInvoiceCreateView.as_view(), name="custom-invoice-create"),
    path("invoices/current/", CurrentInvoiceView.as_view(), name="invoice-current"),
    path("invoices/recover/", InvoiceRecoverView.as_view(), name="invoice-recover"),
    path("account/invoices/", AccountInvoiceCreateView.as_view(), name="account-invoice-create"),
    path("account/custom-invoices/", AccountCustomInvoiceCreateView.as_view(), name="account-custom-invoice-create"),
    path("account/custom-quotes/", AccountCustomQuoteView.as_view(), name="account-custom-quote"),
    path("invoices/<uuid:invoice_id>/session/", InvoiceSessionExchangeView.as_view(), name="invoice-session"),
    path("invoices/<uuid:invoice_id>/", InvoiceDetailView.as_view(), name="invoice-detail"),
    path("invoices/<uuid:invoice_id>/verify/", InvoiceVerifyView.as_view(), name="invoice-verify"),
    path("invoices/<uuid:invoice_id>/replace/", InvoiceReplaceView.as_view(), name="invoice-replace"),
    path("invoices/<uuid:invoice_id>/cancel/", InvoiceCancelView.as_view(), name="invoice-cancel"),
]
