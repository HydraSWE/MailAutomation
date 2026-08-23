import React from "react";
import { Copy, Loader2, Megaphone, Search, Send, X } from "lucide-react";

export default function BroadcastsTable({
  broadcasts = [],
  filteredBroadcasts = [],
  loading = false,
  saving = false,
  statusFilter = "all",
  setStatusFilter,
  searchQuery = "",
  setSearchQuery,
  openDeliveriesLog,
  duplicateBroadcast,
  setConfirmAction,
}) {
  const safeBroadcasts = Array.isArray(broadcasts) ? broadcasts : [];
  const safeFilteredBroadcasts = Array.isArray(filteredBroadcasts) ? filteredBroadcasts : [];

  return (
    <div className="space-y-4">
      {/* Table Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 overflow-x-auto text-xs">
          {[
            { id: "all", label: "All Broadcasts", count: safeBroadcasts.length },
            { id: "draft", label: "Drafts", count: safeBroadcasts.filter((b) => b?.status === "draft").length },
            { id: "inflight", label: "In-Flight", count: safeBroadcasts.filter((b) => ["queued", "sending"].includes(b?.status)).length },
            { id: "completed", label: "Completed", count: safeBroadcasts.filter((b) => b?.status === "completed").length },
            { id: "cancelled", label: "Cancelled", count: safeBroadcasts.filter((b) => b?.status === "cancelled").length },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter && setStatusFilter(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                statusFilter === tab.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  statusFilter === tab.id ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Box with icon padding clearance */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by subject or target..."
            value={searchQuery}
            onChange={(e) => setSearchQuery && setSearchQuery(e.target.value)}
            style={{ paddingLeft: "2.5rem" }}
            className="w-full pr-8 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery && setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Broadcasts Data Table */}
      <div className="border border-slate-800 rounded-2xl bg-slate-900/40 backdrop-blur-sm overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                <th className="py-3.5 px-4">Broadcast Subject</th>
                <th className="py-3.5 px-4">Target Scope</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Delivery Progress</th>
                <th className="py-3.5 px-4">Created Date</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {safeFilteredBroadcasts.map((broadcast) => {
                const total = broadcast.total_count || broadcast.preview_count || 0;
                const sent = broadcast.sent_count || 0;
                const percent = total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0;

                return (
                  <tr key={broadcast.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors">
                        {broadcast.subject}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>By: {broadcast.created_by_email || "Platform Owner"}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {formatTargetBadges(broadcast)}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <StatusPill status={broadcast.status} />
                    </td>

                    <td className="py-3.5 px-4 min-w-[160px]">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-300 font-medium">{sent} / {total} sent</span>
                          <span className="text-slate-400 font-mono">{percent}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              broadcast.status === "failed"
                                ? "bg-rose-500"
                                : broadcast.status === "cancelled"
                                ? "bg-amber-500"
                                : "bg-indigo-500"
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        {broadcast.failed_count > 0 && (
                          <span className="inline-block text-[10px] text-rose-400 font-medium">
                            {broadcast.failed_count} delivery failures
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                      {new Date(broadcast.created_at).toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openDeliveriesLog && openDeliveriesLog(broadcast)}
                          className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white transition-colors text-xs font-medium"
                        >
                          Log
                        </button>

                        <button
                          type="button"
                          onClick={() => duplicateBroadcast && duplicateBroadcast(broadcast)}
                          className="p-1.5 rounded-lg border border-slate-700/80 bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                          title="Duplicate as Draft"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        {broadcast.status === "draft" && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => {
                              const count = broadcast.preview_count ?? broadcast.total_count ?? 0;
                              if (setConfirmAction) {
                                setConfirmAction({
                                  type: "launch",
                                  broadcast,
                                  title: "Launch Platform Broadcast",
                                  message: `Dispatch "${broadcast.subject}" to ${count} matching recipient(s)?`,
                                  confirmLabel: "Launch Broadcast",
                                  isDanger: false,
                                });
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all"
                          >
                            <Send className="w-3 h-3" /> Send
                          </button>
                        )}

                        {["draft", "queued", "sending"].includes(broadcast.status) && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => {
                              if (setConfirmAction) {
                                setConfirmAction({
                                  type: "cancel",
                                  broadcast,
                                  title: "Cancel Platform Broadcast",
                                  message: `Cancel dispatch for "${broadcast.subject}"? Any pending queued recipients will be skipped.`,
                                  confirmLabel: "Cancel Broadcast",
                                  isDanger: true,
                                });
                              }
                            }}
                            className="p-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Cancel Broadcast"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {loading && (
                <tr>
                  <td colSpan="6" className="py-16 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    <span>Loading platform broadcasts...</span>
                  </td>
                </tr>
              )}

              {!loading && safeFilteredBroadcasts.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-16 text-center text-slate-500">
                    <Megaphone className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-60" />
                    <p className="text-sm font-medium text-slate-400">No broadcasts found</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {searchQuery ? "Try refining your search or filter." : "Create your first broadcast to get started."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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

function formatTargetBadges(broadcast) {
  const badges = [];

  if (broadcast.active_only) {
    badges.push(
      <span key="active" className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px]">
        Active Users
      </span>
    );
  }

  if (broadcast.target_roles?.length) {
    badges.push(
      <span key="roles" className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px]">
        Roles: {broadcast.target_roles.join(", ")}
      </span>
    );
  }

  if (broadcast.target_plan_slugs?.length) {
    badges.push(
      <span key="plans" className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[10px]">
        Plans: {broadcast.target_plan_slugs.join(", ")}
      </span>
    );
  }

  if (broadcast.target_organization_statuses?.length) {
    badges.push(
      <span key="org" className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px]">
        Org: {broadcast.target_organization_statuses.join(", ")}
      </span>
    );
  }

  if (badges.length === 0) {
    return (
      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[10px]">
        All Platform Users
      </span>
    );
  }

  return badges;
}
