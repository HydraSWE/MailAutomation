import React from "react";
import { AlertCircle, AlertTriangle, Inbox, Loader2, Search, X } from "lucide-react";

export default function DeliveryInspectorModal({
  selectedBroadcast,
  setSelectedBroadcast,
  deliveries = [],
  loadingDeliveries = false,
  deliverySearch = "",
  setDeliverySearch,
  deliveryStatusFilter = "all",
  setDeliveryStatusFilter,
  deliveryError = "",
  setDeliveryError,
  filteredDeliveries = [],
}) {
  if (!selectedBroadcast) return null;

  const safeDeliveries = Array.isArray(deliveries) ? deliveries : [];
  const safeFilteredDeliveries = Array.isArray(filteredDeliveries) ? filteredDeliveries : [];

  const totalCount = safeDeliveries.length || selectedBroadcast.total_count || selectedBroadcast.preview_count || 0;
  const sentCount = safeDeliveries.filter((d) => d?.status === "sent").length;
  const failedCount = safeDeliveries.filter((d) => d?.status === "failed").length;
  const pendingSkippedCount = safeDeliveries.filter((d) => ["pending", "skipped"].includes(d?.status)).length;

  return (
    <div className="fixed inset-0 z-[95] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[88vh] rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Inbox className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">Delivery Diagnostics</h3>
                <StatusPill status={selectedBroadcast.status} />
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-md">
                {selectedBroadcast.subject}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedBroadcast(null);
              if (setDeliveryError) setDeliveryError("");
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* In-Modal Delivery Error Banner */}
        {deliveryError && (
          <div className="mx-5 mt-4 p-3.5 border border-rose-500/30 bg-rose-500/10 rounded-xl text-xs font-medium text-rose-300 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{deliveryError}</span>
            </div>
            <button
              type="button"
              onClick={() => setDeliveryError && setDeliveryError("")}
              className="text-rose-400 hover:text-rose-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Modal Summary KPI Cards */}
        <div className="p-5 border-b border-slate-800/80 bg-slate-950/40 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60">
            <span className="text-slate-400">Total Recipients</span>
            <div className="text-lg font-bold text-slate-100 mt-1">
              {totalCount}
            </div>
          </div>
          <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60">
            <span className="text-emerald-400">Delivered (Sent)</span>
            <div className="text-lg font-bold text-emerald-300 mt-1">
              {sentCount}
            </div>
          </div>
          <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60">
            <span className="text-rose-400">Failed Deliveries</span>
            <div className="text-lg font-bold text-rose-300 mt-1">
              {failedCount}
            </div>
          </div>
          <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60">
            <span className="text-amber-400">Skipped / Pending</span>
            <div className="text-lg font-bold text-amber-300 mt-1">
              {pendingSkippedCount}
            </div>
          </div>
        </div>

        {/* Modal Search & Filter Bar */}
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/50">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            {["all", "sent", "failed", "pending", "skipped"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setDeliveryStatusFilter && setDeliveryStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg capitalize font-medium transition-colors ${
                  deliveryStatusFilter === st ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter recipient email..."
              value={deliverySearch}
              onChange={(e) => setDeliverySearch && setDeliverySearch(e.target.value)}
              style={{ paddingLeft: "2.25rem" }}
              className="w-full pr-7 py-1.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            {deliverySearch && (
              <button
                type="button"
                onClick={() => setDeliverySearch && setDeliverySearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Deliveries Table Content */}
        <div className="p-5 overflow-y-auto flex-1">
          {loadingDeliveries ? (
            <div className="py-16 text-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
              <span>Loading delivery log entries...</span>
            </div>
          ) : safeFilteredDeliveries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
              <AlertTriangle className="w-8 h-8 mb-2 text-amber-400 opacity-70" />
              <p className="text-sm font-medium text-slate-300">No delivery logs matching filter</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Delivery rows will populate upon batch execution by the dispatch queue.
              </p>
            </div>
          ) : (
            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/70 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                    <th className="py-3 px-3.5">Recipient</th>
                    <th className="py-3 px-3.5">Status</th>
                    <th className="py-3 px-3.5">Attempts</th>
                    <th className="py-3 px-3.5">Message / Diagnosis</th>
                    <th className="py-3 px-3.5 text-right">Sent Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-xs">
                  {safeFilteredDeliveries.map((delivery) => (
                    <tr key={delivery.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-3.5">
                        <div className="font-medium text-slate-200">{delivery.recipient_email}</div>
                        <div className="text-[11px] text-slate-500">{delivery.recipient_name || "-"}</div>
                      </td>
                      <td className="py-3 px-3.5">
                        <StatusPill status={delivery.status} />
                      </td>
                      <td className="py-3 px-3.5 text-slate-400 font-mono">{delivery.attempts ?? 0}</td>
                      <td className="py-3 px-3.5 text-slate-400 text-[11px]">
                        {delivery.message ? (
                          <span className={delivery.status === "failed" ? "text-rose-400 font-medium" : ""}>
                            {delivery.message}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-right text-[11px] text-slate-500 whitespace-nowrap">
                        {delivery.sent_at ? new Date(delivery.sent_at).toLocaleString() : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setSelectedBroadcast(null);
              if (setDeliveryError) setDeliveryError("");
            }}
            className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const styles = {
    draft: "border-slate-700 bg-slate-800 text-slate-300",
    queued: "border-sky-500/30 bg-sky-500/10 text-sky-300 animate-pulse",
    sending: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300 animate-pulse",
    completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    sent: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    failed: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    cancelled: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    pending: "border-slate-700 bg-slate-800 text-slate-400",
    skipped: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold capitalize ${
        styles[status] || styles.draft
      }`}
    >
      {status}
    </span>
  );
}
