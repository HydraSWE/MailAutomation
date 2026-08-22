import { GripVertical, Plus } from "lucide-react";
import { blockTypes } from "./model";

export default function BlockPalette({ onAdd }) {
  return (
    <aside className="builder-panel">
      <h3>Blocks Library</h3>
      <div className="block-library">
        {blockTypes.map((type) => <button key={type} onClick={() => onAdd(type)}><Plus size={15} /> {type}</button>)}
      </div>
      <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
        💡 <strong>Tip:</strong> Drag sections using the grip handles <GripVertical className="inline w-3 h-3" /> to reorder blocks.
      </p>
    </aside>
  );
}
