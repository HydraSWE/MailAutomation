import { LifeBuoy, Pencil, Power, UserPlus, Users } from "lucide-react";

function Status({ value }) {
  const colors = { active: "bg-emerald-500/10 text-emerald-300", suspended: "bg-amber-500/10 text-amber-300", expired: "bg-rose-500/10 text-rose-300" };
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[value] || "bg-slate-800 text-slate-400"}`}>{value}</span>;
}

function IconButton({ title, onClick, tone = "default", children }) {
  const colors = { default: "text-slate-400 hover:text-indigo-300", warning: "text-amber-400 hover:text-amber-300", success: "text-emerald-400 hover:text-emerald-300" };
  return <button type="button" title={title} onClick={onClick} className={`p-1.5 rounded-lg hover:bg-slate-800 transition-colors ${colors[tone]}`}>{children}</button>;
}

export default function OrganizationsTable({ organizations, filtered, loading, toggleSupportWorkspace, openViewUsers, openEdit, toggleStatus, setAdminOrg, setError }) {
  return <>
    <div className="overflow-x-auto border border-slate-800 rounded-md"><table><thead><tr><th>Organization</th><th>Plan</th><th>Status</th><th>Admins</th><th>Members</th><th>SMTP</th><th>Recipients</th><th>Support</th><th>Monthly usage</th><th className="text-right">Actions</th></tr></thead><tbody>
      {filtered.map((organization) => <tr key={organization.id}>
        <td className="font-medium text-slate-200">{organization.name}</td><td>{organization.subscription?.plan_name || "No plan"}</td><td><Status value={organization.status} /></td>
        <td><span className={organization.admin_count >= organization.max_admins ? "text-amber-400 font-semibold" : "text-slate-300"}>{organization.admin_count}/{organization.max_admins}</span></td>
        <td>{organization.user_count}/{organization.max_users}</td><td>{organization.smtp_count}/{organization.max_smtp_accounts}{organization.mailbox_count ? <span className="ml-1 text-xs text-slate-500" title="Support inboxes share the SMTP account limit">+{organization.mailbox_count} inbox</span> : null}</td>
        <td>{organization.recipient_count}/{organization.max_recipients}</td>
        <td><button type="button" onClick={() => toggleSupportWorkspace(organization)} disabled={!organization.support_workspace_available && !organization.support_workspace_enabled} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${organization.support_workspace_enabled ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-800 text-slate-400"}`} title={!organization.support_workspace_available ? "Premium+ and Custom plans only" : organization.support_workspace_enabled ? "Hide mail workspace from organization admins" : "Enable mail workspace for organization admins"}><LifeBuoy className="h-3.5 w-3.5" />{!organization.support_workspace_available ? "Plan locked" : organization.support_workspace_enabled ? "Enabled" : "Hidden"}</button></td>
        <td>{organization.usage?.monthly_sent || 0}/{organization.monthly_email_limit}</td>
        <td><div className="flex justify-end gap-1"><IconButton title="View team members & admins" onClick={() => openViewUsers(organization)}><Users /></IconButton><IconButton title="Edit organization" onClick={() => openEdit(organization)}><Pencil /></IconButton><IconButton title={organization.status === "active" ? "Suspend organization" : "Reactivate organization"} onClick={() => toggleStatus(organization)} tone="warning"><Power /></IconButton><IconButton title="Add administrator" onClick={() => { setAdminOrg(organization); setError(""); }} tone="success"><UserPlus /></IconButton></div></td>
      </tr>)}
      {!loading && filtered.length === 0 && <tr><td colSpan="10" className="py-12 text-center text-slate-500">No organizations match these filters.</td></tr>}
      {loading && <tr><td colSpan="10" className="py-12 text-center text-slate-500">Loading organizations…</td></tr>}
    </tbody></table></div><p className="text-xs text-slate-600">Showing {filtered.length} of {organizations.length} organizations</p>
  </>;
}
