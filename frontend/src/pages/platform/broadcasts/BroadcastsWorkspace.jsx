import React from "react";
import { AlertCircle, CheckCircle2, Megaphone, Plus, RefreshCw, X } from "lucide-react";
import ConfirmDialog from "../../../components/common/ConfirmDialog";
import { useBroadcastsWorkspace } from "./useBroadcastsWorkspace";
import BroadcastsKpiStrip from "./BroadcastsKpiStrip";
import BroadcastComposerStudio from "./BroadcastComposerStudio";
import BroadcastsTable from "./BroadcastsTable";
import DeliveryInspectorModal from "./DeliveryInspectorModal";
import api from "../../../services/api";
import { EMPTY_FORM, formatError } from "./constants";

export default function BroadcastsWorkspace() {
  const ws = useBroadcastsWorkspace();

  return (
    <div className="space-y-7 max-w-7xl">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Platform Broadcasts</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Dispatch system-wide announcements and operational notices to tenant mailboxes.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={ws.loadData}
            disabled={ws.loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-700/80 bg-slate-800/60 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:border-slate-600 transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${ws.loading ? "animate-spin" : ""}`} /> Refresh
          </button>

          <button
            type="button"
            onClick={ws.openNewBroadcastStudio}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" /> New Broadcast
          </button>
        </div>
      </div>

      {/* Global Page Alerts (Rendered only when NO modal is open) */}
      {!ws.studioOpen && !ws.selectedBroadcast && ws.pageMessage && (
        <div className="p-3.5 border border-emerald-500/30 bg-emerald-500/10 rounded-xl text-xs font-medium text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{ws.pageMessage}</span>
          </div>
          <button type="button" onClick={() => ws.setPageMessage("")} className="text-emerald-400 hover:text-emerald-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!ws.studioOpen && !ws.selectedBroadcast && ws.pageError && (
        <div className="p-3.5 border border-rose-500/30 bg-rose-500/10 rounded-xl text-xs font-medium text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{ws.pageError}</span>
          </div>
          <button type="button" onClick={() => ws.setPageError("")} className="text-rose-400 hover:text-rose-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Executive KPI Strip */}
      <BroadcastsKpiStrip metrics={ws.metrics} />

      {/* Broadcast History Table */}
      <BroadcastsTable
        broadcasts={ws.broadcasts}
        filteredBroadcasts={ws.filteredBroadcasts}
        loading={ws.loading}
        saving={ws.saving}
        statusFilter={ws.statusFilter}
        setStatusFilter={ws.setStatusFilter}
        searchQuery={ws.searchQuery}
        setSearchQuery={ws.setSearchQuery}
        openDeliveriesLog={ws.openDeliveriesLog}
        duplicateBroadcast={ws.duplicateBroadcast}
        setConfirmAction={ws.setConfirmAction}
      />

      {/* Broadcast Studio Composer Modal */}
      <BroadcastComposerStudio
        studioOpen={ws.studioOpen}
        setStudioOpen={ws.setStudioOpen}
        studioTab={ws.studioTab}
        setStudioTab={ws.setStudioTab}
        studioError={ws.studioError}
        setStudioError={ws.setStudioError}
        form={ws.form}
        setForm={ws.setForm}
        plans={ws.plans}
        previewCount={ws.previewCount}
        previewing={ws.previewing}
        saving={ws.saving}
        checkAudiencePreview={ws.checkAudiencePreview}
        applyPreset={ws.applyPreset}
        insertVariable={ws.insertVariable}
        saveDraft={ws.saveDraft}
        setConfirmAction={ws.setConfirmAction}
      />

      {/* Delivery Diagnostics Inspector Modal */}
      <DeliveryInspectorModal
        selectedBroadcast={ws.selectedBroadcast}
        setSelectedBroadcast={ws.setSelectedBroadcast}
        deliveries={ws.deliveries}
        loadingDeliveries={ws.loadingDeliveries}
        deliverySearch={ws.deliverySearch}
        setDeliverySearch={ws.setDeliverySearch}
        deliveryStatusFilter={ws.deliveryStatusFilter}
        setDeliveryStatusFilter={ws.setDeliveryStatusFilter}
        deliveryError={ws.deliveryError}
        setDeliveryError={ws.setDeliveryError}
        filteredDeliveries={ws.filteredDeliveries}
      />

      {/* Safety Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(ws.confirmAction)}
        title={ws.confirmAction?.title}
        message={ws.confirmAction?.message}
        confirmLabel={ws.confirmAction?.confirmLabel}
        isDanger={ws.confirmAction?.isDanger}
        loading={ws.saving}
        onCancel={() => ws.setConfirmAction(null)}
        onConfirm={async () => {
          const action = ws.confirmAction;
          if (!action) return;
          ws.setConfirmAction(null);

          if (action.type === "launch") {
            await ws.launchBroadcast(action.broadcast);
          } else if (action.type === "cancel") {
            await ws.cancelBroadcast(action.broadcast);
          } else if (action.type === "create_and_launch") {
            ws.setSaving(true);
            try {
              const res = await api.post("/platform/broadcasts/", action.formPayload);
              const created = res.data;
              await api.post(`/platform/broadcasts/${created.id}/launch/`);
              const dispatchMsg = `Broadcast "${created.subject}" created and queued for dispatch.`;
              ws.setPageMessage(dispatchMsg);
              ws.setForm(EMPTY_FORM);
              ws.setStudioOpen(false);
              await ws.loadData();
            } catch (err) {
              const formatted = formatError(err);
              ws.setStudioError(formatted);
            } finally {
              ws.setSaving(false);
            }
          }
        }}
      />
    </div>
  );
}
