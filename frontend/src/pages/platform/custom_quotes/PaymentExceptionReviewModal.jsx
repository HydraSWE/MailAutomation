import { useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle, ExternalLink, Loader2, ShieldAlert, X } from "lucide-react";

export default function PaymentExceptionReviewModal({
  quote,
  isOpen,
  onClose,
  onApprovePayment,
  onRejectPayment,
  loading,
}) {
  const [notes, setNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !quote || !quote.invoice) return null;

  const invoice = quote.invoice;
  const exceptionReason = invoice.verification_error || "Manual review required";

  async function handleApprove() {
    setError("");
    const res = await onApprovePayment(quote.id, notes.trim());
    if (!res.success) {
      setError(res.error);
    }
  }

  async function handleReject() {
    setError("");
    const res = await onRejectPayment(quote.id, rejectionReason.trim());
    if (!res.success) {
      setError(res.error);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl bg-slate-900 border border-purple-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>


        <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-wider">
          <ShieldAlert className="w-4 h-4" />
          <span>Payment Exception Manual Review</span>
        </div>
        <h2 className="text-2xl font-black text-white mt-1">Review Payment Claim</h2>
        <div className="text-xs text-slate-400 mt-1">
          Quote #{quote.quote_number} • {quote.organization_name} ({quote.customer_email})
        </div>

        {/* Flagged Alert */}
        <div className="mt-4 p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-xs text-purple-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-purple-300">Flagged Reason:</div>
            <div className="mt-0.5 text-purple-100 font-mono">{exceptionReason}</div>
          </div>
        </div>

        {/* Transaction Details */}
        <div className="mt-4 p-4 rounded-2xl bg-slate-950/60 border border-white/[0.08] text-xs space-y-2.5">
          <div className="flex justify-between">
            <span className="text-slate-400">Expected Invoice USDT</span>
            <span className="font-bold text-white font-mono">{invoice.amount_usdt} USDT</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Network</span>
            <span className="font-bold text-cyan-300">{invoice.network?.toUpperCase()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Receiving Address</span>
            <span className="font-mono text-slate-300 text-[11px] truncate max-w-[220px]">{invoice.receiving_address}</span>
          </div>
          {invoice.transaction_hash && (
            <div className="flex justify-between items-center pt-1 border-t border-white/[0.06]">
              <span className="text-slate-400">Transaction Hash</span>
              <div className="flex items-center gap-1.5 font-mono text-cyan-300 text-[11px]">
                <span className="truncate max-w-[180px]">{invoice.transaction_hash}</span>
                {invoice.explorer_url && (
                  <a
                    href={invoice.explorer_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 p-0.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 font-medium">
            {error}
          </div>
        )}

        {!isRejecting ? (
          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Approval Notes (Optional)</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Underpaid by 0.05 USDT, customer approved grace waiver..."
                className="w-full rounded-xl bg-slate-950/70 border border-white/10 px-4 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={handleApprove}
                className="flex-1 rounded-xl py-3 px-4 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50 shadow-lg shadow-purple-950/40"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                <span>Approve Exception & Send Activation</span>
              </button>

              <button
                type="button"
                onClick={() => setIsRejecting(true)}
                className="px-4 py-3 rounded-xl border border-red-500/30 text-red-300 hover:bg-red-500/10 text-xs font-bold transition"
              >
                Reject Claim
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 space-y-3">
            <div className="text-xs font-bold text-red-300">Rejection Reason</div>
            <textarea
              rows={2}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Transaction hash not found on blockchain explorer..."
              className="w-full rounded-xl bg-slate-950/80 border border-red-500/30 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={handleReject}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition"
              >
                Confirm Rejection
              </button>
              <button
                type="button"
                onClick={() => setIsRejecting(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

