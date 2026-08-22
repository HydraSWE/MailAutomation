import { GripVertical, LayoutTemplate, Plus } from "lucide-react";
import { renderBlock } from "./model";

export default function BlockCanvas({ blocks, selectedId, draggedIndex, dragOverIndex, onAdd, onSelect, onDragStart, onDragOver, onDrop, onDragEnd }) {
  return (
    <div className="email-stage"><div className="email-canvas">
      {blocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-300 rounded-xl my-auto text-slate-400">
          <LayoutTemplate className="w-12 h-12 mb-3 text-indigo-500 opacity-80" />
          <h4 className="font-bold text-slate-700 text-base">Template Canvas is Empty</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">All blocks have been removed. Add a block from the library to begin.</p>
          <button onClick={() => onAdd("Heading")} className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"><Plus size={14} /> Add Heading Block</button>
        </div>
      ) : blocks.map((block, index) => {
        const selected = selectedId === block.id;
        const dragging = draggedIndex === index;
        const dragOver = dragOverIndex === index && draggedIndex !== index;
        return (
          <div key={block.id} draggable onDragStart={(event) => onDragStart(event, index)} onDragOver={(event) => onDragOver(event, index)} onDrop={(event) => onDrop(event, index)} onDragEnd={onDragEnd} onClick={() => onSelect(block.id)} className={`canvas-block group relative transition-all duration-150 ${selected ? "selected" : ""} ${dragging ? "opacity-40 border-2 border-dashed border-indigo-400 scale-[0.98]" : ""} ${dragOver ? "border-2 border-indigo-500 bg-indigo-50/60 shadow-lg shadow-indigo-500/10 scale-[1.01]" : ""}`}>
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/80 text-slate-200 px-1.5 py-1 rounded-md text-[10px] flex items-center gap-1 cursor-grab active:cursor-grabbing shadow-md z-10" title="Click and drag to reorder this section"><GripVertical size={13} className="text-indigo-400" /><span className="font-mono text-[9px]">Drag</span></div>
            {renderBlock(block)}
          </div>
        );
      })}
    </div></div>
  );
}
