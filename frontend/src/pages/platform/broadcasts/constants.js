export const EMPTY_FORM = {
  subject: "",
  body: "",
  target_roles: [],
  target_plan_slugs: [],
  target_organization_statuses: [],
  active_only: true,
};

export const ROLE_OPTIONS = [
  { value: "owner", label: "Owner", desc: "Account creator & billing lead" },
  { value: "admin", label: "Admin", desc: "Organization administrator" },
  { value: "manager", label: "Manager", desc: "Campaigns & list manager" },
  { value: "operator", label: "Operator", desc: "Dispatch operator" },
  { value: "viewer", label: "Viewer", desc: "Read-only auditor" },
];

export const ORGANIZATION_STATUS_OPTIONS = [
  { value: "active", label: "Active", desc: "Currently in good standing" },
  { value: "suspended", label: "Suspended", desc: "Temporarily locked tenants" },
  { value: "expired", label: "Expired", desc: "Lapsed subscription tenants" },
];

export const TEMPLATE_VARIABLES = [
  { tag: "{{user_name}}", label: "User Name" },
  { tag: "{{organization_name}}", label: "Org Name" },
  { tag: "{{plan_name}}", label: "Plan Name" },
  { tag: "{{support_email}}", label: "Support Email" },
];

export function formatError(requestError) {
  const data = requestError.response?.data;
  if (!data) return "Request failed.";
  if (typeof data === "string") return data;
  return (
    data.detail ||
    Object.entries(data)
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
      .join(" ")
  );
}
