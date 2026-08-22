import { Eye, FileCode } from "lucide-react";
import { RAW_HTML_PRESETS } from "./model";

export default function RawHtmlEditor({ value, onChange, textareaRef }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col space-y-3">
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><FileCode className="w-4 h-4 text-indigo-400" /><h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Raw HTML Code Input</h3></div><div className="flex items-center gap-2"><button type="button" onClick={() => onChange(RAW_HTML_PRESETS.responsive)} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-all">Load Responsive Preset</button><button type="button" onClick={() => onChange(RAW_HTML_PRESETS.minimal)} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-all">Load Minimal Preset</button></div></div>
        <textarea ref={textareaRef} rows={20} value={value} onChange={(event) => onChange(event.target.value)} placeholder="Paste or type your raw email HTML markup here... Use {name}, {company}, {email} for dynamic recipient variables." className="w-full font-mono text-xs p-3 bg-slate-950 border border-slate-800 text-slate-100 rounded-xl focus:outline-none focus:border-indigo-500 leading-relaxed resize-y" />
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col space-y-3">
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Eye className="w-4 h-4 text-emerald-400" /><h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Live HTML Preview</h3></div><span className="text-[10px] text-slate-500 font-mono">Updates in real-time</span></div>
        <div className="bg-white rounded-xl border border-slate-300 h-[480px] overflow-hidden"><iframe sandbox="" srcDoc={value || "<html><body style='font-family:sans-serif;padding:20px;color:#94a3b8;'>(Empty HTML Content)</body></html>"} title="Live HTML Preview" className="w-full h-full border-0" /></div>
      </div>
    </div>
  );
}
