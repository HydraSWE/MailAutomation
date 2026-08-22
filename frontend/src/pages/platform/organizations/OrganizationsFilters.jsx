import CustomSelect from "../../../components/common/CustomSelect";
import SearchInput from "../../../components/common/SearchInput";

export default function OrganizationsFilters({ search, setSearch, status, setStatus }) {
  return <div className="flex flex-col sm:flex-row gap-3">
    <SearchInput value={search} onChange={setSearch} placeholder="Search organizations..." className="flex-1" />
    <CustomSelect value={status} onChange={setStatus} options={[{ value: "all", label: "All statuses" }, { value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }, { value: "expired", label: "Expired" }]} ariaLabel="Filter organization status" className="sm:w-44" />
  </div>;
}
