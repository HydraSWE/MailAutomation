import React from "react";
import { Activity, Megaphone, TrendingUp, UserCheck } from "lucide-react";

export default function BroadcastsKpiStrip({ metrics }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Total Broadcasts</span>
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Megaphone className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-100">{metrics.total}</span>
          <span className="text-xs text-slate-500">recorded</span>
        </div>
      </div>

      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">In-Flight Queue</span>
          <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
            <Activity className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-100">{metrics.inflight}</span>
          <span className="text-xs text-slate-500">active dispatch</span>
        </div>
      </div>

      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Delivered Reach</span>
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <UserCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-100">
            {new Intl.NumberFormat().format(metrics.totalSent)}
          </span>
          <span className="text-xs text-slate-500">recipients</span>
        </div>
      </div>

      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Success Rate</span>
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-100">{metrics.successRate}%</span>
          <span className="text-xs text-slate-500">deliverability</span>
        </div>
      </div>
    </div>
  );
}
