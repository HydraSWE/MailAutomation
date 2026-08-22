import { Sparkles } from "lucide-react";
import { RECIPIENT_VARIABLES } from "./model";

export default function VariableInserter({ onInsert }) {
  return (
    <div className="p-4 bg-indigo-950/40 border border-indigo-800/50 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-indigo-200 text-xs"><Sparkles className="w-4 h-4 text-indigo-400 shrink-0" /><span><strong>Recipient Variables:</strong> Click to insert variables into your Subject line or Template content. They are automatically replaced when emails are dispatched.</span></div>
      <div className="flex items-center gap-2 flex-wrap">{RECIPIENT_VARIABLES.map((variable) => <button key={variable.tag} type="button" onClick={() => onInsert(variable.tag)} title={variable.desc} className="px-3 py-1 bg-indigo-600/30 hover:bg-indigo-600/60 text-indigo-200 border border-indigo-500/40 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-1.5 cursor-pointer"><span>{variable.tag}</span><span className="text-[10px] text-indigo-300 font-sans">({variable.label})</span></button>)}</div>
    </div>
  );
}
