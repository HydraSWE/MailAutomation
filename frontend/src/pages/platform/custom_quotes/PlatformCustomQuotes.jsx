import { CheckCircle2, Filter, Loader2, RefreshCw, Sparkles } from "lucide-react";
import SearchInput from "../../../components/common/SearchInput";
import CustomQuoteReviewModal from "./CustomQuoteReviewModal";

import CustomQuotesTable from "./CustomQuotesTable";
import PaymentExceptionReviewModal from "./PaymentExceptionReviewModal";
import { useCustomQuotesWorkspace } from "./useCustomQuotesWorkspace";

const STATUS_FILTERS = [
  { id: "", label: "All Quotes" },
  { id: "pending_review", label: "Pending Review" },
  { id: "invoiced", label: "Invoiced (72h)" },
  { id: "payment_review", label: "Payment Review" },
  { id: "activation_pending", label: "Activation Pending" },
  { id: "activated", label: "Activated" },
  { id: "rejected", label: "Rejected" },
];

export default function PlatformCustomQuotes() {
  const {
    quotes,
    loading,
    error,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    loadQuotes,
    selectedQuoteForReview,
    setSelectedQuoteForReview,
    selectedQuoteForPaymentReview,
    setSelectedQuoteForPaymentReview,
    actionLoading,
    actionMessage,
    setActionMessage,
    handleApproveAndInvoice,
    handleRejectQuote,
    handleApprovePaymentException,
    handleRejectPaymentException,
  } = useCustomQuotesWorkspace();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Platform Owner Governance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">Enterprise Custom Quotes</h1>
          <p className="text-xs text-slate-400 mt-1">
            Review custom plan requests, customize limits, set BDT pricing, and lock 72-hour USDT network invoices.
          </p>
        </div>

        <button
          type="button"
          onClick={loadQuotes}
          disabled={loading}
          className="px-4 py-2.5 rounded-xl border border-white/10 hover:bg-slate-800 text-slate-300 font-bold text-xs flex items-center gap-2 transition self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Success Notification Banner */}
      {actionMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 font-semibold flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionMessage}</span>
          </div>
          <button
            onClick={() => setActionMessage("")}
            className="text-emerald-400 hover:text-emerald-300 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search & Filter Tabs */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {STATUS_FILTERS.map((tab) => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  active
                    ? "bg-cyan-400 text-slate-950 shadow-md shadow-cyan-950/40"
                    : "bg-slate-900 border border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search quote #, customer, org..."
          className="min-w-[260px]"
        />
      </div>


      {/* Main Table */}
      {loading && quotes.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-12 text-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-cyan-400" />
          <p className="text-xs font-medium">Loading custom quotes...</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 font-semibold">
          {error}
        </div>
      ) : (
        <CustomQuotesTable
          quotes={quotes}
          onReviewQuote={(q) => setSelectedQuoteForReview(q)}
          onReviewPayment={(q) => setSelectedQuoteForPaymentReview(q)}
        />
      )}

      {/* Review & Pricing Modal */}
      <CustomQuoteReviewModal
        quote={selectedQuoteForReview}
        isOpen={Boolean(selectedQuoteForReview)}
        onClose={() => setSelectedQuoteForReview(null)}
        onApproveAndInvoice={handleApproveAndInvoice}
        onRejectQuote={handleRejectQuote}
        loading={actionLoading}
      />

      {/* Payment Exception Modal */}
      <PaymentExceptionReviewModal
        quote={selectedQuoteForPaymentReview}
        isOpen={Boolean(selectedQuoteForPaymentReview)}
        onClose={() => setSelectedQuoteForPaymentReview(null)}
        onApprovePayment={handleApprovePaymentException}
        onRejectPayment={handleRejectPaymentException}
        loading={actionLoading}
      />
    </div>
  );
}
