const ACTIONS = [
  ["status", "Update Status", "px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-100 rounded-lg text-xs font-medium transition-colors"],
  ["list", "Assign List", "px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-100 rounded-lg text-xs font-medium transition-colors"],
  ["tags", "Assign Tags", "px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-100 rounded-lg text-xs font-medium transition-colors"],
  ["delete", "Bulk Delete", "px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 text-rose-100 rounded-lg text-xs font-medium transition-colors"],
];

export default function RecipientBulkActions({ selectedCount, setAction, modal }) {
  if (!selectedCount) return null;
  return (
    <div className="flex items-center justify-between p-3.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-sm animate-fade-in">
      <span className="font-semibold text-indigo-200">{selectedCount} recipient(s) selected</span>
      <div className="flex items-center gap-2">{ACTIONS.map(([action, label, classes]) => <button key={action} onClick={() => { setAction(action); modal.openModal(); }} className={classes}>{label}</button>)}</div>
    </div>
  );
}
