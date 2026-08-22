import { ArrowRight } from "lucide-react";
import CustomSelect from "../../common/CustomSelect";

export default function ColumnMapperStep({ headers, columnMapping, setColumnMapping, setStep, onNext }) {
  return (
        <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-6 shadow-xl">
          <div>
            <h3 className="text-lg font-bold text-slate-100">Map File Headers to Recipient & Lead Fields</h3>
            <p className="text-xs text-slate-400 mt-1">
              Select which spreadsheet columns correspond to contact fields and social profiles.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: "email", label: "Emails Column", required: true },
              { key: "company", label: "Company Name", required: false },
              { key: "name", label: "Full Name / Contact", required: false },
              { key: "phone", label: "Phones Column", required: false },
              { key: "website", label: "Website URL", required: false },
              { key: "facebook", label: "Facebook Link", required: false },
              { key: "instagram", label: "Instagram Link", required: false },
              { key: "linkedin", label: "LinkedIn Link", required: false },
              { key: "twitter", label: "Twitter / X Link", required: false },
              { key: "youtube", label: "YouTube Link", required: false },
            ].map((field) => (
              <div key={field.key} className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5">
                <label className="block text-xs font-semibold text-slate-200">
                  {field.label} {field.required && <span className="text-rose-400">*</span>}
                </label>
                <CustomSelect
                  value={columnMapping[field.key]}
                  onChange={(header) => setColumnMapping({ ...columnMapping, [field.key]: header })}
                  options={[
                    { value: "", label: "Do Not Import" },
                    ...headers.map((header) => ({ value: header, label: header })),
                  ]}
                  ariaLabel={`${field.label} mapping`}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm font-medium"
            >
              Back
            </button>
            <button
              onClick={onNext}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-600/25"
            >

              <ArrowRight className="w-4 h-4" />Next: Validate Data
            </button>
          </div>
        </div>
  );
}

