import { AlertTriangle, Clock, ExternalLink, FileText, CheckCircle, ShieldAlert } from "lucide-react";
import { QUOTE_STATUS_CONFIG } from "./constants";

const format = (v) => new Intl.NumberFormat("en-US").format(v || 0);

export default function CustomQuotesTable({
  quotes,
  onReviewQuote,
  onReviewPayment,
}) {
  if (!quotes || quotes.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-12 text-center text-slate-400">
        <FileText className="w-10 h-10 mx-auto mb-3 text-slate-600" />
        <p className="text-sm font-semibold text-slate-300">No Custom Quotes Found</p>
        <p className="text-xs text-slate-500 mt-1">Quotes submitted by enterprise customers will appear here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-3xl border border-white/10 bg-slate-900/60 shadow-xl">
      <table className="w-full text-left text-xs text-slate-300">
        <thead className="border-b border-white/10 bg-slate-950/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <tr>
            <th className="px-5 py-4">Quote #</th>
            <th className="px-5 py-4">Customer & Org</th>
            <th className="px-5 py-4">Requested Capacity</th>
            <th className="px-5 py-4">Status</th>
            <th className="px-5 py-4">Quoted Price</th>
            <th className="px-5 py-4">Date</th>
            <th className="px-5 py-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {quotes.map((quote) => {
            const statusConfig = QUOTE_STATUS_CONFIG[quote.status] || {
              label: quote.status,
              bg: "bg-slate-800",
              text: "text-slate-300",
              border: "border-slate-700",
            };
            const limits = quote.approved_limits || quote.requested_limits || {};
            const isPendingReview = quote.status === "pending_review";
            const isPaymentReview = quote.status === "payment_review" || quote.invoice?.status === "review_required";

            return (
              <tr key={quote.id} className="hover:bg-slate-800/40 transition">
                <td className="px-5 py-4 font-mono font-bold text-cyan-300">
                  {quote.quote_number}
                </td>
                <td className="px-5 py-4">
                  <div className="font-bold text-white">{quote.organization_name}</div>
                  <div className="text-[11px] text-slate-400">{quote.customer_name} ({quote.customer_email})</div>
                </td>
                <td className="px-5 py-4">
                  <div className="text-white font-medium">{format(limits.email_limit)} emails/mo</div>
                  <div className="text-[11px] text-slate-400">
                    {limits.max_smtp_accounts} inboxes • {limits.max_admins} admins • {limits.max_users} users
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                  >
                    {statusConfig.label}
                  </span>
                </td>
                <td className="px-5 py-4">
                  {quote.quoted_price_bdt ? (
                    <div>
                      <div className="font-bold text-emerald-300">BDT {format(quote.quoted_price_bdt)}</div>
                      {quote.invoice && (
                        <div className="text-[11px] text-slate-400">
                          {quote.invoice.amount_usdt} USDT ({quote.selected_network?.toUpperCase()})
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-500 font-medium">Not Priced</span>
                  )}
                </td>
                <td className="px-5 py-4 text-slate-400 whitespace-nowrap">
                  {new Date(quote.created_at).toLocaleDateString()}
                </td>
                <td className="px-5 py-4 text-right whitespace-nowrap">
                  {isPaymentReview && (
                    <button
                      type="button"
                      onClick={() => onReviewPayment(quote)}
                      className="px-3 py-1.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-purple-950/40"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Review Payment</span>
                    </button>
                  )}

                  {isPendingReview && (
                    <button
                      type="button"
                      onClick={() => onReviewQuote(quote)}
                      className="px-3 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-cyan-950/40"
                    >
                      <span>Review & Price</span>
                    </button>
                  )}

                  {!isPendingReview && !isPaymentReview && (
                    <button
                      type="button"
                      onClick={() => onReviewQuote(quote)}
                      className="px-3 py-1.5 rounded-xl border border-white/10 hover:bg-white/10 text-slate-300 font-medium text-xs transition"
                    >
                      <span>View Details</span>
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
