import { ArrowRight, Calendar, Send } from "lucide-react";
import DateTimePicker from "../../../components/common/DateTimePicker";

export default function Step5Schedule({ campaignData, setCampaignData, setStep, handleNextStep }) {
  return (
        <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-6 shadow-xl">
          <div>
            <h3 className="text-lg font-bold text-slate-100">Step 5: Schedule & Sending Options</h3>
            <p className="text-xs text-slate-400 mt-1">Choose immediate dispatch or set future delivery datetime.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              onClick={() => setCampaignData({ ...campaignData, send_type: "now" })}
              className={`p-5 rounded-2xl border cursor-pointer transition-all ${campaignData.send_type === "now"
                  ? "bg-indigo-600/10 border-indigo-500 ring-2 ring-indigo-500/50"
                  : "bg-slate-950/60 border-slate-800"
                }`}
            >
              <div className="flex items-center gap-3">
                <Send className="w-6 h-6 text-indigo-400" />
                <div>
                  <h4 className="font-bold text-slate-100">Send Immediately</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Queue and launch campaign right now.</p>
                </div>
              </div>
            </div>

            <div
              onClick={() => setCampaignData({ ...campaignData, send_type: "scheduled" })}
              className={`p-5 rounded-2xl border cursor-pointer transition-all ${campaignData.send_type === "scheduled"
                  ? "bg-indigo-600/10 border-indigo-500 ring-2 ring-indigo-500/50"
                  : "bg-slate-950/60 border-slate-800"
                }`}
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-6 h-6 text-emerald-400" />
                <div>
                  <h4 className="font-bold text-slate-100">Schedule for Later</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Pick specific future date and time.</p>
                </div>
              </div>
            </div>
          </div>

          {campaignData.send_type === "scheduled" && (
            <div className="p-5 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-4">
              <DateTimePicker
                value={campaignData.scheduled_at}
                onChange={(val) => setCampaignData({ ...campaignData, scheduled_at: val })}
                label="Select Scheduled Sending Date & Time"
                required={true}
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button onClick={() => setStep(4)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm font-medium">
              Back
            </button>
            <button
              onClick={handleNextStep}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/25"
            >

              <ArrowRight className="w-4 h-4" />Next: Review & Confirm
            </button>
          </div>
        </div>
  );
}

