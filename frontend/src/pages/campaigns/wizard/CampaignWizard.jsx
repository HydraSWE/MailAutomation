import React from "react";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Save,
  Send,
  Calendar,
  Sparkles,
  Layers,
  Users,
  Server,
  FileText,
  Clock,
} from "lucide-react";
import { useCampaignWizard } from "./useCampaignWizard";
import Step1Details from "./Step1Details";
import Step2TemplateSelect from "./Step2TemplateSelect";
import Step3Recipients from "./Step3Recipients";
import Step4SmtpSelect from "./Step4SmtpSelect";
import Step5Schedule from "./Step5Schedule";
import Step6Review from "./Step6Review";

export default function CreateCampaignPage() {
  const {
    navigate, step, setStep, submitting, campaignData, setCampaignData,
    templates, lists, smtpServers, loadingResources, handleNextStep,
    handleCreateCampaign, selectedTemplate, selectedList, selectedSmtp,
  } = useCampaignWizard();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/campaigns")}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Create Email Campaign</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Configure targeting, template layouts, SMTP servers, and send schedules.
          </p>
        </div>
      </div>

      {/* Stepper Progress */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 p-3 bg-slate-900/60 border border-slate-800 rounded-2xl">
        {[
          { num: 1, label: "1. Details" },
          { num: 2, label: "2. Template" },
          { num: 3, label: "3. Audience" },
          { num: 4, label: "4. SMTP" },
          { num: 5, label: "5. Schedule" },
          { num: 6, label: "6. Review" },
        ].map((s) => (
          <div
            key={s.num}
            onClick={() => {
              if (step > s.num) setStep(s.num);
            }}
            className={`p-2.5 text-center text-xs font-semibold rounded-xl transition-all cursor-pointer ${step === s.num
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : step > s.num
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                  : "bg-slate-800/50 text-slate-400 opacity-60"
              }`}
          >
            {s.label}
          </div>
        ))}
      </div>

      {/* Step 1: Details */}
      {step === 1 && <Step1Details campaignData={campaignData} setCampaignData={setCampaignData} handleNextStep={handleNextStep} />}
      {/* Step 2: Select Template */}
      {step === 2 && <Step2TemplateSelect templates={templates} campaignData={campaignData} setCampaignData={setCampaignData} navigate={navigate} setStep={setStep} handleNextStep={handleNextStep} />}
      {/* Step 3: Audience */}
      {step === 3 && <Step3Recipients lists={lists} campaignData={campaignData} setCampaignData={setCampaignData} setStep={setStep} handleNextStep={handleNextStep} />}
      {/* Step 4: SMTP Server */}
      {step === 4 && <Step4SmtpSelect smtpServers={smtpServers} campaignData={campaignData} setCampaignData={setCampaignData} setStep={setStep} handleNextStep={handleNextStep} />}
      {/* Step 5: Schedule */}
      {step === 5 && <Step5Schedule campaignData={campaignData} setCampaignData={setCampaignData} setStep={setStep} handleNextStep={handleNextStep} />}
      {/* Step 6: Review */}
      {step === 6 && <Step6Review campaignData={campaignData} selectedTemplate={selectedTemplate} selectedList={selectedList} selectedSmtp={selectedSmtp} setStep={setStep} handleCreateCampaign={handleCreateCampaign} submitting={submitting} />}
    </div>
  );
}
