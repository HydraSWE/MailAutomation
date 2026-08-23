import { ArrowRight, BookOpen, ExternalLink } from "lucide-react";

export default function SupportDocumentation() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-xs text-slate-300">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
          <BookOpen className="h-4 w-4 text-indigo-400" /> Developer and Infrastructure Guides
        </h3>
        <p className="mt-1 text-slate-400">
          Access our step-by-step guides for custom SMTP relay configuration, webhook payloads, and deliverability ramp-up schedules.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <a
            href="/help"
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3.5 font-medium text-slate-200 transition-colors hover:border-indigo-500/40 hover:text-white"
          >
            <span className="flex items-center gap-2">
              <ArrowRight className="h-3.5 w-3.5 text-indigo-400" /> DNS Verification Guide (SPF and DKIM)
            </span>
            <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
          </a>

          <a
            href="/help"
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3.5 font-medium text-slate-200 transition-colors hover:border-indigo-500/40 hover:text-white"
          >
            <span className="flex items-center gap-2">
              <ArrowRight className="h-3.5 w-3.5 text-indigo-400" /> REST API and Webhooks Reference
            </span>
            <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
          </a>

          <a
            href="/help"
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3.5 font-medium text-slate-200 transition-colors hover:border-indigo-500/40 hover:text-white"
          >
            <span className="flex items-center gap-2">
              <ArrowRight className="h-3.5 w-3.5 text-emerald-400" /> Automated IP Warmup Schedule
            </span>
            <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
          </a>

          <a
            href="/help"
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3.5 font-medium text-slate-200 transition-colors hover:border-indigo-500/40 hover:text-white"
          >
            <span className="flex items-center gap-2">
              <ArrowRight className="h-3.5 w-3.5 text-cyan-400" /> USDT TRC-20 Invoice Confirmation
            </span>
            <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
          </a>
        </div>
      </div>
    </div>
  );
}
