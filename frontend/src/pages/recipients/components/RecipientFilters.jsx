import { RotateCcw } from "lucide-react";
import FilterDropdown from "../../../components/common/FilterDropdown";
import SearchInput from "../../../components/common/SearchInput";

export default function RecipientFilters({ search, setSearch, selectedList, setSelectedList, selectedStatus, setSelectedStatus, selectedTag, setSelectedTag, lists, tags, setPage, onClear }) {
  const update = (setter) => (value) => { setter(value); setPage(1); };
  const active = search || selectedList || selectedStatus || selectedTag;
  return (
    <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <SearchInput value={search} onChange={update(setSearch)} placeholder="Search name, email, company..." />
        <FilterDropdown label="List" value={selectedList} onChange={update(setSelectedList)} options={lists.map((list) => ({ value: list.id, label: list.name || list.list_name || `List #${list.id}` }))} />
        <FilterDropdown label="Status" value={selectedStatus} onChange={update(setSelectedStatus)} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, { value: "unsubscribed", label: "Unsubscribed" }, { value: "bounced", label: "Bounced" }]} />
        <FilterDropdown label="Tag" value={selectedTag} onChange={update(setSelectedTag)} options={tags.map((tag) => ({ value: tag, label: tag }))} />
      </div>
      {active && <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs"><span className="text-slate-400">Filters applied</span><button onClick={onClear} className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-medium transition-colors"><RotateCcw className="w-3.5 h-3.5" />Clear Filters</button></div>}
    </div>
  );
}
