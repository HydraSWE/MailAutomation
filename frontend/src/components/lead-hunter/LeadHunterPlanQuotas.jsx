import { Gift, Check, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function LeadHunterPlanQuotas() {
  return (
    <section id="plans" className="py-20 px-5 lg:px-8 max-w-6xl mx-auto">
      <div className="bg-slate-900/70 backdrop-blur-xl rounded-3xl p-8 sm:p-12 border border-emerald-500/30 text-center">
        
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold mb-4">
          <Gift className="w-3.5 h-3.5" />
          <span>Included with Every Active Mail Flow Subscription</span>
        </div>

        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-4">
          Lead Hunter Quotas by Mail Flow Plan
        </h2>
        <p className="text-slate-400 max-w-2xl mx-auto text-sm mb-10">
          You don't need a separate subscription. Your monthly extraction quota is determined automatically by your active Mail Flow plan:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          
          {/* STARTER */}
          <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Mail Flow Starter</div>
            <div className="text-xl font-extrabold text-white mb-3">Starter Quota</div>
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400" /> <strong>2,500 Recipient Quota</strong></li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400" /> <strong>250 Leads / Batch</strong> extraction limit</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400" /> All 4 Scraper Channels</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400" /> 2 Authorized Devices</li>
            </ul>
          </div>

          {/* PRO (FEATURED) */}
          <div className="p-6 rounded-2xl bg-slate-950 border-2 border-indigo-500 shadow-xl relative">
            <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Mail Flow Pro</div>
            <div className="text-xl font-extrabold text-white mb-3">Pro Quota</div>
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-indigo-400" /> <strong>10,000 Recipient Quota</strong></li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-indigo-400" /> <strong>500 Leads / Batch</strong> extraction limit</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-indigo-400" /> Multi-threaded scraper speed</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-indigo-400" /> 2 Authorized Devices</li>
            </ul>
          </div>

          {/* ENTERPRISE */}
          <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800">
            <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1">Mail Flow Enterprise</div>
            <div className="text-xl font-extrabold text-white mb-3">Enterprise Quota</div>
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-cyan-400" /> <strong>50,000+ Recipient Quota</strong></li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-cyan-400" /> <strong>1,000 Leads / Batch</strong> extraction limit</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-cyan-400" /> Custom quotas & multi-seat setup</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-cyan-400" /> 2 Authorized Devices</li>
            </ul>
          </div>

        </div>

        <div className="mt-8">
          <Link
            to="/#pricing"
            className="inline-flex items-center gap-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>View Mail Flow Subscription Plans</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
