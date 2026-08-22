import { ArrowRight, CheckCircle2, Users } from "lucide-react";

export default function Step3Recipients({ lists, campaignData, setCampaignData, setStep, handleNextStep }) {
  return (
        <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-6 shadow-xl">
          <div>
            <h3 className="text-lg font-bold text-slate-100">Step 3: Select Target Audience</h3>
            <p className="text-xs text-slate-400 mt-1">Choose recipient contact list for dispatch.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lists.map((l) => {
              const isSelected = String(l.id) === String(campaignData.recipient_list_id);
              return (
                <div
                  key={l.id}
                  onClick={() => setCampaignData({ ...campaignData, recipient_list_id: l.id })}
                  className={`p-5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${isSelected
                      ? "bg-indigo-600/10 border-indigo-500 ring-2 ring-indigo-500/50 shadow-xl"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                    }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo-400" />
                      <h4 className="text-base font-bold text-slate-100">{l.list_name || l.name}</h4>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {l.recipient_count || 0} Total Active Contacts
                    </p>
                  </div>
                  {isSelected && <CheckCircle2 className="w-6 h-6 text-indigo-400" />}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button onClick={() => setStep(2)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm font-medium">
              Back
            </button>
            <button
              onClick={handleNextStep}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/25"
            >

              <ArrowRight className="w-4 h-4" />Next: Select SMTP Server
            </button>
          </div>
        </div>
  );
}

