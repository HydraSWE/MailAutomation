import { CheckCircle2, Download } from "lucide-react";

export default function ImportResultStep({ importResult, file, navigate, onDownloadErrors }) {
  return (
        <div className="p-8 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-6 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Leads Import Completed</h2>
            <p className="text-sm text-slate-400 mt-1">
              Import summary for {file?.name || "Premium_Maps_Leads.csv"}.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto text-left">
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
              <p className="text-xs text-slate-400 font-medium">Imported Leads</p>
              <p className="text-xl font-bold text-emerald-400 mt-0.5">
                {importResult.imported_count}
              </p>
            </div>
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
              <p className="text-xs text-slate-400 font-medium">No Email Rows</p>
              <p className="text-xl font-bold text-slate-300 mt-0.5">
                {importResult.skipped_count}
              </p>
            </div>
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
              <p className="text-xs text-slate-400 font-medium">Updated/Duplicates</p>
              <p className="text-xl font-bold text-amber-400 mt-0.5">
                {importResult.duplicate_count}
              </p>
            </div>
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
              <p className="text-xs text-slate-400 font-medium">Invalid Emails</p>
              <p className="text-xl font-bold text-rose-400 mt-0.5">
                {importResult.invalid_count}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            {(importResult.duplicate_count > 0 || importResult.invalid_count > 0) && (
              <button
                onClick={onDownloadErrors}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                Download Skipped Rows Report
              </button>
            )}
            <button onClick={() => navigate("/recipients")} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/25">
              Go to Recipients & Leads List
            </button>
          </div>
        </div>
  );
}

