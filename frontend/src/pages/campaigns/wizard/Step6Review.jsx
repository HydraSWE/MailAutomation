import { Save, Send } from "lucide-react";

export default function Step6Review({ campaignData, selectedTemplate, selectedList, selectedSmtp, setStep, handleCreateCampaign, submitting }) {
  return (
        <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-6 shadow-xl">
          <div>
            <h3 className="text-lg font-bold text-slate-100">Step 6: Review Campaign Summary</h3>
            <p className="text-xs text-slate-400 mt-1">Verify configuration details before saving or launching.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/80 p-5 rounded-2xl border border-slate-800 text-sm">
            <div>
              <p className="text-xs text-slate-400 font-semibold">Campaign Name</p>
              <p className="font-bold text-slate-100 mt-0.5">{campaignData.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold">Subject Line</p>
              <p className="font-mono text-indigo-300 mt-0.5">{campaignData.subject}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold">Template</p>
              <p className="text-slate-200 mt-0.5">{selectedTemplate?.title || selectedTemplate?.name || "Selected Template"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold">Recipient List</p>
              <p className="text-slate-200 mt-0.5">
                {selectedList?.list_name || selectedList?.name || "General Contacts"} ({selectedList?.recipient_count || 0} Contacts)
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold">SMTP Server</p>
              <p className="text-slate-200 mt-0.5">{selectedSmtp?.name} ({selectedSmtp?.host})</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold">Schedule</p>
              <p className="text-emerald-400 font-semibold mt-0.5">
                {campaignData.send_type === "now" ? "Immediate Launch" : `Scheduled: ${campaignData.scheduled_at}`}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button onClick={() => setStep(5)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm font-medium">
              Back
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleCreateCampaign(true)}
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium transition-colors"
              >
                <Save className="w-4 h-4" />
                Save as Draft
              </button>
              <button
                onClick={() => handleCreateCampaign(false)}
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-600/25 active:scale-95 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {submitting ? "Processing..." : campaignData.send_type === "now" ? "Launch Campaign Now" : "Schedule Campaign"}
              </button>
            </div>
          </div>
        </div>
  );
}

