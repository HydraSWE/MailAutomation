import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import api from "../services/api";
import { getActiveOrganization, setActiveOrganization } from "../utils/auth";
import CustomSelect from "./common/CustomSelect";

export default function ActiveOrganizationSwitcher() {
  const [organizations, setOrganizations] = useState([]);
  const [selected, setSelected] = useState(() => String(getActiveOrganization()?.id || ""));

  useEffect(() => {
    let active = true;
    api.get("/organizations/").then((response) => {
      if (active) setOrganizations(response.data.results || response.data || []);
    }).catch(() => {
      if (active) setOrganizations([]);
    });
    return () => { active = false; };
  }, []);

  function changeOrganization(value) {
    const organization = organizations.find((item) => String(item.id) === value);
    setActiveOrganization(organization || null);
    setSelected(value);
    window.location.reload();
  }

  return (
    <div className="hidden md:flex min-w-52 items-center gap-2 rounded-xl border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-1.5">
      <Building2 className="h-4 w-4 shrink-0 text-indigo-300" />
      <CustomSelect
        value={selected}
        onChange={changeOrganization}
        ariaLabel="Active organization"
        options={[
          { value: "", label: "Platform-wide" },
          ...organizations.map((organization) => ({
            value: String(organization.id),
            label: organization.name,
          })),
        ]}
      />
    </div>
  );
}
