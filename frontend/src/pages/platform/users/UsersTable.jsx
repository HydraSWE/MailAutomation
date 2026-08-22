import { Edit2, Key, Loader2, LogOut, ShieldOff, Trash2, UserCheck, UserX } from "lucide-react";

function IconButton({ title, onClick, tone = "default", children }) {
  const colors = { default: "text-slate-400 hover:text-indigo-300", warning: "text-amber-400 hover:text-amber-300", success: "text-emerald-400 hover:text-emerald-300", danger: "text-rose-400 hover:text-rose-300" };
  return <button type="button" title={title} onClick={onClick} className={`p-1.5 rounded-lg hover:bg-slate-800 transition-colors ${colors[tone]}`}>{children}</button>;
}

export default function UsersTable({ users, filtered, loading, roleBadge, openEdit, setPasswordModal, setNewPassword, setError, reset2FA, toggleActive, revokeSessions, setDeleteTarget }) {
  return <>
    <div className="overflow-x-auto border border-slate-800 rounded-xl"><table><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Organization</th><th>2FA</th><th>Status</th><th>Sessions</th><th>Last seen</th><th className="text-right">Actions</th></tr></thead><tbody>
      {filtered.map((user) => <tr key={user.id}>
        <td><div className="font-medium text-slate-200">{user.name || user.username}</div><div className="text-xs text-slate-500">@{user.username}</div></td>
        <td className="text-sm">{user.email}</td><td>{roleBadge(user.role)}</td><td className="text-sm text-slate-300">{user.organization_name || "-"}</td>
        <td><span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${user.two_factor_enabled ? "bg-emerald-400/10 text-emerald-300 border-emerald-500/30" : "bg-slate-500/10 text-slate-500 border-slate-600/30"}`}>{user.two_factor_enabled ? "Active" : "Off"}</span></td>
        <td><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${user.is_active ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"}`}>{user.is_active ? "Active" : "Inactive"}</span></td>
        <td className="text-sm text-slate-400">{user.active_session_count || 0}</td><td className="text-xs text-slate-500">{user.last_seen_at ? new Date(user.last_seen_at).toLocaleString() : "-"}</td>
        <td><div className="flex justify-end gap-1"><IconButton title="Edit user" onClick={() => openEdit(user)}><Edit2 /></IconButton>
          {user.can_reset_password && <IconButton title="Reset password" onClick={() => { setPasswordModal(user); setNewPassword(""); setError(""); }} tone="warning"><Key /></IconButton>}
          {user.can_reset_2fa && <IconButton title="Reset 2FA Authenticator" onClick={() => reset2FA(user)} tone="warning"><ShieldOff /></IconButton>}
          {user.is_active && user.can_deactivate && <IconButton title="Deactivate" onClick={() => toggleActive(user)} tone="warning"><UserX /></IconButton>}
          {!user.is_active && <IconButton title="Reactivate" onClick={() => toggleActive(user)} tone="success"><UserCheck /></IconButton>}
          {user.active_session_count > 0 && <IconButton title="Revoke all sessions" onClick={() => revokeSessions(user)} tone="warning"><LogOut /></IconButton>}
          {user.can_delete && <IconButton title="Delete user" onClick={() => setDeleteTarget(user)} tone="danger"><Trash2 /></IconButton>}
        </div></td>
      </tr>)}
      {!loading && filtered.length === 0 && <tr><td colSpan="9" className="py-12 text-center text-slate-500">No users match these filters.</td></tr>}
      {loading && <tr><td colSpan="9" className="py-12 text-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading users…</td></tr>}
    </tbody></table></div>
    <p className="text-xs text-slate-600">Showing {filtered.length} of {users.length} users</p>
  </>;
}
