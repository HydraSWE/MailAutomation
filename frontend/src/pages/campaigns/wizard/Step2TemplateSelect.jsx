import { ArrowRight, CheckCircle2, FileText } from "lucide-react";

export default function Step2TemplateSelect({ templates, campaignData, setCampaignData, navigate, setStep, handleNextStep }) {
  return (
        <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-6 shadow-xl">
          <div>
            <h3 className="text-lg font-bold text-slate-100">Step 2: Select Email Template</h3>
            <p className="text-xs text-slate-400 mt-1">Choose a pre-designed layout for your campaign content.</p>
          </div>

          {templates.length === 0 ? (
            <div className="p-8 text-center bg-slate-950/60 border border-slate-800 rounded-2xl">
              <FileText className="w-10 h-10 text-slate-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-300">No templates found.</p>
              <p className="text-xs text-slate-400 mt-1">Create a template in the Template Builder or select Default Template.</p>
              <button
                type="button"
                onClick={() => navigate("/templates")}
                className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
              >
                Go to Template Builder
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {templates.map((tpl) => {
                const isSelected = String(tpl.id) === String(campaignData.template_id);
                return (
                  <div
                    key={tpl.id}
                    onClick={() => setCampaignData({ ...campaignData, template_id: tpl.id })}
                    className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between space-y-3 ${isSelected
                        ? "bg-indigo-600/10 border-indigo-500 ring-2 ring-indigo-500/50 shadow-xl"
                        : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                      }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                          Template
                        </span>
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-indigo-400" />}
                      </div>
                      <h4 className="text-base font-bold text-slate-100">{tpl.title || tpl.name}</h4>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {tpl.subject || tpl.description || "Responsive Email Layout"}
                      </p>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 border-t border-slate-800/80 pt-2">
                      Subject: {tpl.subject || campaignData.subject}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button onClick={() => setStep(1)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm font-medium">
              Back
            </button>
            <button
              onClick={handleNextStep}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/25"
            >

              <ArrowRight className="w-4 h-4" /> Next: Select Audience
            </button>
          </div>
        </div>
  );
}

