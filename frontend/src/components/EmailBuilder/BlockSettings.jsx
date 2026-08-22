import { ArrowDown, ArrowUp, Palette, Trash2 } from "lucide-react";
import { PRESET_COLORS } from "./model";

export default function BlockSettings({ selected, blockCount, onMove, onRemove, onUpdate, onOpenPalette }) {
  return (
    <aside className="builder-panel">
      <h3>Block Settings</h3>
      {selected ? <>
        <div className="settings-actions">
          <button onClick={() => onMove(-1)} title="Move Up"><ArrowUp size={15} /></button>
          <button onClick={() => onMove(1)} title="Move Down"><ArrowDown size={15} /></button>
          <button onClick={onRemove} title="Delete Block" className="text-rose-400"><Trash2 size={15} /></button>
        </div>
        <span className="text-[11px] font-bold tracking-wider text-indigo-400 uppercase">{selected.type} Block Settings</span>
        <div className="block-fields space-y-4 mt-3">
          {selected.data && Object.entries(selected.data).map(([key, value]) => {
            const colorField = key === "color" || key === "background" || key.includes("color");
            if (colorField) return (
              <div key={key} className="flex flex-col gap-2">
                <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-300 capitalize">{key.replace("_", " ")} Color</span><button type="button" onClick={() => onOpenPalette(key)} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded border border-slate-700"><Palette size={11} /> Choose Palette</button></div>
                <div className="flex items-center gap-2"><input type="color" value={value || "#000000"} onChange={(event) => onUpdate(key, event.target.value)} className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer" /><input type="text" value={value || ""} onChange={(event) => onUpdate(key, event.target.value)} placeholder="#000000" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-indigo-500" /></div>
                <div className="flex items-center gap-1.5 flex-wrap pt-1">{PRESET_COLORS.map((color) => <div key={color} onClick={() => onUpdate(key, color)} style={{ backgroundColor: color }} title={color} className={`w-5 h-5 rounded-md cursor-pointer border transition-transform hover:scale-110 ${value === color ? "border-white ring-2 ring-indigo-500" : "border-slate-700"}`} />)}</div>
              </div>
            );
            return (
              <label key={key} className="flex flex-col gap-1.5 text-xs font-medium text-slate-300">
                <span className="capitalize">{key.replace("_", " ")}</span>
                {key === "html" || key === "text" ? <textarea rows={3} value={value || ""} onChange={(event) => onUpdate(key, event.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500" /> : <input type={key === "height" ? "number" : "text"} value={value || ""} onChange={(event) => onUpdate(key, event.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500" />}
              </label>
            );
          })}
        </div>
      </> : <p className="text-xs text-slate-400 mt-2">{blockCount === 0 ? "The canvas is currently empty. Add a block from the library on the left to edit its properties." : "Select a block on the canvas to edit its properties."}</p>}
    </aside>
  );
}
