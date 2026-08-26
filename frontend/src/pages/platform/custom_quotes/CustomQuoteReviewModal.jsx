import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, ChevronRight, FileText, Loader2, Send, ShieldAlert, X } from "lucide-react";
import CustomSelect from "../../../components/common/CustomSelect";
import { SUPPORTED_NETWORKS } from "./constants";
import { useAutoDismiss } from "../../../hooks/useAutoDismiss";



const format = (v) => new Intl.NumberFormat("en-US").format(v || 0);

export default function CustomQuoteReviewModal({
  quote,
  isOpen,
  onClose,
  onApproveAndInvoice,
  onRejectQuote,
  loading,
}) {
  const [bdtPrice, setBdtPrice] = useState("");
  const [network, setNetwork] = useState("bsc");
  const [ownerNotes, setOwnerNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [error, setError] = useAutoDismiss("");

  // Editable approved limits
  const [emailLimit, setEmailLimit] = useState(300000);
  const [maxAdmins, setMaxAdmins] = useState(8);
  const [maxUsers, setMaxUsers] = useState(80);
  const [maxSmtp, setMaxSmtp] = useState(15);
  const [maxRecipients, setMaxRecipients] = useState(50000);
  const [maxCampaigns, setMaxCampaigns] = useState(20);

  useEffect(() => {
    if (quote) {
      const limits = quote.approved_limits || quote.requested_limits || {};
      setEmailLimit(limits.email_limit || 300000);
      setMaxAdmins(limits.max_admins || 8);
      setMaxUsers(limits.max_users || 80);
      setMaxSmtp(limits.max_smtp_accounts || 15);
      setMaxRecipients(limits.max_recipients || 50000);
      setMaxCampaigns(limits.max_campaigns_per_day || 20);

      setBdtPrice(quote.quoted_price_bdt ? String(quote.quoted_price_bdt) : "");
      setNetwork(quote.selected_network || "bsc");
      setOwnerNotes(quote.owner_notes || "");
      setRejectionReason(quote.rejection_reason || "");
      setIsRejecting(false);
      setError("");
    }
  }, [quote]);

  if (!isOpen || !quote) return null;

  const isReadOnly = quote.status !== "pending_review" && quote.status !== "invoiced";

  async function handleSubmitApprove(e) {
    e.preventDefault();
    setError("");
    const parsedPrice = parseInt(bdtPrice, 10);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return setError("Please enter a valid approved BDT price (greater than zero).");
    }

    const payload = {
      price_bdt: parsedPrice,
      network: network,
      owner_notes: ownerNotes.trim(),
      approved_limits: {
        email_limit: parseInt(emailLimit, 10),
        max_admins: parseInt(maxAdmins, 10),
        max_users: parseInt(maxUsers, 10),
        max_smtp_accounts: parseInt(maxSmtp, 10),
        max_recipients: parseInt(maxRecipients, 10),
        max_campaigns_per_day: parseInt(maxCampaigns, 10),
      },
    };

    const res = await onApproveAndInvoice(quote.id, payload);
    if (!res.success) {
      setError(res.error);
    }
  }

  async function handleConfirmReject() {
    setError("");
    const res = await onRejectQuote(quote.id, rejectionReason.trim());
    if (!res.success) {
      setError(res.error);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
          <FileText className="w-4 h-4" />
          <span>Platform Owner Custom Quote Review</span>
        </div>
        <h2 className="text-2xl font-black text-white mt-1">Quote #{quote.quote_number}</h2>
        <div className="text-xs text-slate-400 mt-1">
          {quote.organization_name} : {quote.customer_name} ({quote.customer_email})
        </div>

        {/* Customer Notes */}
        {quote.notes && (
          <div className="mt-4 p-3.5 rounded-2xl bg-slate-950/60 border border-white/[0.08] text-xs">
            <span className="text-slate-500 font-bold block mb-1">Customer Special Requirements / Notes:</span>
            <p className="text-slate-300 italic">{quote.notes}</p>
          </div>
        )}

        <form onSubmit={handleSubmitApprove} className="mt-5 space-y-5">
          {/* Capacity Limits Tuning */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">Approved Entitlements</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Monthly Emails</label>
                <input
                  type="number"
                  disabled={isReadOnly}
                  value={emailLimit}
                  onChange={(e) => setEmailLimit(e.target.value)}
                  className="w-full rounded-xl bg-slate-950/70 border border-white/10 px-3 py-2 text-xs text-white font-semibold disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Admins</label>
                <input
                  type="number"
                  disabled={isReadOnly}
                  value={maxAdmins}
                  onChange={(e) => setMaxAdmins(e.target.value)}
                  className="w-full rounded-xl bg-slate-950/70 border border-white/10 px-3 py-2 text-xs text-white font-semibold disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Team Users</label>
                <input
                  type="number"
                  disabled={isReadOnly}
                  value={maxUsers}
                  onChange={(e) => setMaxUsers(e.target.value)}
                  className="w-full rounded-xl bg-slate-950/70 border border-white/10 px-3 py-2 text-xs text-white font-semibold disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">SMTP Inboxes</label>
                <input
                  type="number"
                  disabled={isReadOnly}
                  value={maxSmtp}
                  onChange={(e) => setMaxSmtp(e.target.value)}
                  className="w-full rounded-xl bg-slate-950/70 border border-white/10 px-3 py-2 text-xs text-white font-semibold disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Recipients</label>
                <input
                  type="number"
                  disabled={isReadOnly}
                  value={maxRecipients}
                  onChange={(e) => setMaxRecipients(e.target.value)}
                  className="w-full rounded-xl bg-slate-950/70 border border-white/10 px-3 py-2 text-xs text-white font-semibold disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Campaigns / Day</label>
                <input
                  type="number"
                  disabled={isReadOnly}
                  value={maxCampaigns}
                  onChange={(e) => setMaxCampaigns(e.target.value)}
                  className="w-full rounded-xl bg-slate-950/70 border border-white/10 px-3 py-2 text-xs text-white font-semibold disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* Pricing & Network Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Custom Approved Price (BDT) *</label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-500 font-bold text-xs">BDT</span>
                <input
                  type="number"
                  required
                  disabled={isReadOnly}
                  value={bdtPrice}
                  onChange={(e) => setBdtPrice(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full rounded-xl bg-slate-950/70 border border-cyan-500/30 pl-12 pr-4 py-2.5 text-xs text-white font-bold placeholder-slate-500 focus:border-cyan-400 focus:outline-none disabled:opacity-50"
                />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Platform exchange rate will lock into the generated invoice.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Receiving USDT Network *</label>
              <CustomSelect
                disabled={isReadOnly}
                value={network}
                onChange={setNetwork}
                options={SUPPORTED_NETWORKS.map((net) => ({
                  value: net.id,
                  label: `${net.name} (${net.feeNote})`,
                }))}
                ariaLabel="Receiving USDT Network"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Locked network for customer's 72-hour payment window.
              </span>
            </div>
          </div>

          {/* Owner Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Internal Notes (Optional)</label>
            <textarea
              rows={2}
              disabled={isReadOnly}
              value={ownerNotes}
              onChange={(e) => setOwnerNotes(e.target.value)}
              placeholder="e.g. Agreed in client call, dedicated onboarding scheduled..."
              className="w-full rounded-xl bg-slate-950/70 border border-white/10 px-4 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none disabled:opacity-50"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          {!isReadOnly && !isRejecting && (
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-xl py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50 shadow-lg shadow-cyan-950/40"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>Approve & Issue 72h Invoice</span>
              </button>

              <button
                type="button"
                onClick={() => setIsRejecting(true)}
                className="px-4 py-3 rounded-xl border border-red-500/30 text-red-300 hover:bg-red-500/10 text-xs font-bold transition"
              >
                Decline Quote
              </button>
            </div>
          )}

          {isRejecting && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 space-y-3">
              <div className="text-xs font-bold text-red-300">Provide Rejection Reason (sent to customer)</div>
              <textarea
                rows={2}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Current infrastructure cannot accommodate requested concurrent throughput..."
                className="w-full rounded-xl bg-slate-950/80 border border-red-500/30 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleConfirmReject}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition"
                >
                  Confirm Decline
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
        </form>
      </div>
    </div>,
    document.body
  );
}

