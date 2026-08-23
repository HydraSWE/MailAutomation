import React, { useState } from "react";
import { useRouteError, Link } from "react-router-dom";
import { AlertTriangle, ChevronDown, ChevronRight, Home, RefreshCw } from "lucide-react";

export default function RouteErrorBoundary() {
  const error = useRouteError();
  const [showDetails, setShowDetails] = useState(false);

  const errorMessage =
    error?.statusText ||
    error?.message ||
    (typeof error === "string" ? error : "An unexpected application error occurred.");

  const errorStack = error?.stack;

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-md text-center space-y-6">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-400">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-100">Something went wrong</h2>
          <p className="text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
            We encountered an issue rendering this section. You can try refreshing or returning to the dashboard.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Page
          </button>

          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-600/25"
          >
            <Home className="w-3.5 h-3.5" /> Go to Dashboard
          </Link>
        </div>

        {/* Collapsible Error Diagnosis */}
        <div className="pt-4 border-t border-slate-800/80 text-left">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {showDetails ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <span>Diagnostic Details</span>
          </button>

          {showDetails && (
            <div className="mt-3 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-rose-300 space-y-2 overflow-x-auto">
              <div className="font-semibold">{errorMessage}</div>
              {errorStack && (
                <pre className="text-[11px] text-slate-500 whitespace-pre-wrap leading-normal max-h-48 overflow-y-auto">
                  {errorStack}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
