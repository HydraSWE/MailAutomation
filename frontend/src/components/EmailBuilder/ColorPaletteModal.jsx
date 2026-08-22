import FormModal from "../common/FormModal";
import { COLOR_PALETTES } from "./model";

export default function ColorPaletteModal({ open, onClose, onSelect }) {
  if (!open) return null;
  return (
    <FormModal isOpen onClose={onClose} title="Choose Color Theme Palette" subtitle="Select from curated, harmonious color palettes for your email layout." maxWidth="max-w-xl">
      <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
        {COLOR_PALETTES.map((palette) => (
          <div key={palette.name} className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2 hover:border-indigo-500/50 transition-colors">
            <h4 className="text-xs font-bold text-slate-200">{palette.name}</h4>
            <p className="text-[11px] text-slate-400">{palette.description}</p>
            <div className="grid grid-cols-4 gap-2 pt-1">
              {palette.colors.map((color) => (
                <button key={color.hex} type="button" onClick={() => onSelect(color.hex)} className="p-2 bg-slate-950 border border-slate-800 hover:border-indigo-500 rounded-lg flex flex-col items-center gap-1.5 transition-all group cursor-pointer">
                  <div style={{ backgroundColor: color.hex }} className="w-6 h-6 rounded-full border border-slate-700 shadow-sm group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-mono text-slate-300">{color.hex}</span>
                  <span className="text-[9px] text-slate-400 truncate w-full text-center">{color.name}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </FormModal>
  );
}
