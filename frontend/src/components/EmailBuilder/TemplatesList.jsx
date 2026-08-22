import { CheckCircle2, LayoutTemplate, Trash2 } from "lucide-react";

export default function TemplatesList({ templates, selectedId, onSelect, onDelete }) {
  if (!templates.length) return null;
  return (
    <div className="p-5 bg-slate-900/40 border border-slate-800 rounded-2xl space-y-4">
      <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-slate-300 flex items-center gap-2"><LayoutTemplate size={16} className="text-indigo-400" />Saved Templates Gallery</h3><span className="text-xs font-medium px-2 py-1 bg-slate-800 text-slate-400 rounded-md">{templates.length} templates</span></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
        {templates.map((template) => {
          const selected = selectedId === template.id;
          return (
            <div key={template.id} onClick={() => onSelect(template)} className={`group relative p-4 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col h-24 justify-between ${selected ? "bg-indigo-900/20 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.15)] ring-1 ring-indigo-500/50" : "bg-slate-800/40 border-slate-700/60 hover:bg-slate-800 hover:border-slate-600 hover:shadow-lg"}`}>
              <div className="flex items-start justify-between gap-2"><h4 className={`font-semibold text-sm truncate ${selected ? "text-indigo-300" : "text-slate-200 group-hover:text-indigo-200"}`} title={template.title}>{template.title}</h4><button onClick={(event) => onDelete(event, template.id, template.title)} className={`opacity-0 group-hover:opacity-100 p-1.5 -m-1.5 rounded-md transition-all ${selected ? "text-indigo-400 hover:text-rose-400 hover:bg-rose-500/10" : "text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"}`} title="Delete Template"><Trash2 size={14} /></button></div>
              <p className="text-[11px] text-slate-500 truncate" title={template.subject}>{template.subject || "No subject"}</p>
              {selected && <div className="absolute -top-2 -right-2 bg-indigo-500 text-white p-1 rounded-full shadow-md border-2 border-slate-900"><CheckCircle2 size={12} /></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
