import { Download } from "lucide-react";

export default function ValidationStep({ allRows, validationResult, setStep, onDownloadErrors, onImport, submitting }) {
  return (
        <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-6 shadow-xl">
          <div>
            <h3 className="text-lg font-bold text-slate-100">Data Validation Check</h3>
            <p className="text-xs text-slate-400 mt-1">
              Validating emails and extracting clean lead records across all {allRows.length} rows.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
              <p className="text-xs font-semibold text-emerald-400">Valid Email Leads</p>
              <p className="text-2xl font-bold text-emerald-200 mt-1">
                {validationResult.validRows.length}
              </p>
            </div>
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <p className="text-xs font-semibold text-amber-400">Duplicate Emails</p>
              <p className="text-2xl font-bold text-amber-200 mt-1">
                {validationResult.duplicateRows.length}
              </p>
            </div>
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl">
              <p className="text-xs font-semibold text-rose-400">Missing Email Rows</p>
              <p className="text-2xl font-bold text-rose-200 mt-1">
                {validationResult.invalidRows.length}
              </p>
            </div>
          </div>

          {(validationResult.invalidRows.length > 0 || validationResult.duplicateRows.length > 0) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
                  Skipped & Flagged Rows Detail
                </h4>
                <button
                  onClick={onDownloadErrors}
                  className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Error Report
                </button>
              </div>
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl max-h-40 overflow-y-auto space-y-1 text-xs font-mono text-slate-300">
                {[...validationResult.invalidRows, ...validationResult.duplicateRows].map((err, i) => (
                  <div key={i} className="flex items-center justify-between py-1 border-b border-slate-800/60 last:border-0">
                    <span>Row #{err.rowNumber}: {err.email}</span>
                    <span className="text-rose-400">{err.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm font-medium"
            >
              Back
            </button>
            <button
              onClick={onImport}
              disabled={submitting || validationResult.validRows.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-600/25 active:scale-95 disabled:opacity-50"
            >
              {submitting ? "Importing Leads..." : `Confirm & Import ${validationResult.validRows.length} Valid Leads`}
            </button>
          </div>
        </div>
  );
}

