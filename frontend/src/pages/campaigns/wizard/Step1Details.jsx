import { ArrowRight } from "lucide-react";

export default function Step1Details({ campaignData, setCampaignData, handleNextStep }) {
  return (
        <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4 shadow-xl">
          <h3 className="text-lg font-bold text-slate-100 mb-4">Step 1: Campaign Details</h3>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Campaign Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={campaignData.name}
              onChange={(e) => setCampaignData({ ...campaignData, name: e.target.value })}
              placeholder="e.g. Lead Generation Announcement 2026"
              className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Email Subject Line <span className="text-rose-400">*</span>
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                value={campaignData.subject}
                onChange={(e) => setCampaignData({ ...campaignData, subject: e.target.value })}
                placeholder="e.g. Exclusive Business Insights for {company}"
                className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:border-indigo-500 pr-36"
              />
              <div className="absolute right-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCampaignData((prev) => ({ ...prev, subject: prev.subject + " {name}" }))}
                  className="text-[10px] bg-slate-800 hover:bg-slate-700 text-indigo-300 px-1.5 py-0.5 rounded border border-slate-700 font-mono"
                  title="Insert {name} variable"
                >
                  +{`{name}`}
                </button>
                <button
                  type="button"
                  onClick={() => setCampaignData((prev) => ({ ...prev, subject: prev.subject + " {company}" }))}
                  className="text-[10px] bg-slate-800 hover:bg-slate-700 text-indigo-300 px-1.5 py-0.5 rounded border border-slate-700 font-mono"
                  title="Insert {company} variable"
                >
                  +{`{company}`}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Tip: Use <code className="text-indigo-300">{`{name}`}</code> or <code className="text-indigo-300">{`{company}`}</code> to personalize subject lines for each recipient.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Optional Internal Description
            </label>
            <textarea
              rows={3}
              value={campaignData.description}
              onChange={(e) => setCampaignData({ ...campaignData, description: e.target.value })}
              placeholder="Internal notes regarding campaign target audience..."
              className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              onClick={handleNextStep}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/25"
            >

              <ArrowRight className="w-4 h-4" />Next: Select Template
            </button>
          </div>
        </div>
  );
}

