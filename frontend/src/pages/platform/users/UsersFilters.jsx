import CustomSelect from "../../../components/common/CustomSelect";
import SearchInput from "../../../components/common/SearchInput";

const ROLES = [{ value: "admin", label: "Admin" }, { value: "manager", label: "Manager" }, { value: "operator", label: "Operator" }, { value: "viewer", label: "Viewer" }];

export default function UsersFilters({ search, setSearch, organization, setOrganization, role, setRole, status, setStatus, organizations }) {
  return <div className="flex flex-col sm:flex-row gap-3">
    <SearchInput value={search} onChange={setSearch} placeholder="Search by name, email, username..." className="flex-1" />
    <CustomSelect value={organization} onChange={setOrganization} options={[{ value: "", label: "All organizations" }, ...organizations.map((item) => ({ value: String(item.id), label: item.name }))]} ariaLabel="Filter by organization" className="sm:w-48" />
    <CustomSelect value={role} onChange={setRole} options={[{ value: "", label: "All roles" }, ...ROLES]} ariaLabel="Filter by role" className="sm:w-36" />
    <CustomSelect value={status} onChange={setStatus} options={[{ value: "", label: "All statuses" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} ariaLabel="Filter by status" className="sm:w-36" />
  </div>;
}
