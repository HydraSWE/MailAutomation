import { Check, Edit2, Key, LogOut, Shield, Trash2, UserCheck, UserX, X } from "lucide-react";
import CustomSelect from "../../../components/common/CustomSelect";
import ConfirmDialog from "../../../components/common/ConfirmDialog";

export default function OrganizationDialogs({ organizationModal, editing, closeOrganizationModal, saveOrganization, error, setError, form, setForm, plans, selectedPlan, saving, adminOrg, setAdminOrg, createAdmin, admin, setAdmin, viewUsersOrg, setViewUsersOrg, loadingUsers, orgUsers, editingRole, setEditingRole, handleRoleChange, passwordTarget, setPasswordTarget, tempPassword, setTempPassword, handleSetPassword, toggleUserActive, handleRevokeUserSessions, deleteOrgUser, statusConfirmOrg, setStatusConfirmOrg, confirmToggleStatus, deleteUserTarget, setDeleteUserTarget, confirmDeleteOrgUser }) {
  return <>
      {/* Organization Modal */}
      {organizationModal && (
        <Modal
          title={editing ? "Edit organization" : "Create organization"}
          onClose={closeOrganizationModal}
        >
          <form onSubmit={saveOrganization} className="space-y-5">
            {error && <Notice error>{error}</Notice>}

            <label className="block text-xs text-slate-400">
              Organization name
              <input
                type="text"
                className="mt-1 w-full"
                required
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
              />
            </label>

            <div>
              <span className="block text-xs text-slate-400">Pricing plan</span>
              <CustomSelect
                className="mt-1"
                value={form.plan_slug}
                onChange={(plan_slug) => setForm({ ...form, plan_slug })}
                options={[
                  { value: "", label: "Select a plan" },
                  ...plans
                    .filter(
                      (plan) => plan.is_active || plan.slug === form.plan_slug
                    )
                    .map((plan) => ({
                      value: plan.slug,
                      label: `${plan.name}${plan.is_active ? "" : " (inactive)"}`,
                    })),
                ]}
                ariaLabel="Pricing plan"
              />
            </div>

            {selectedPlan && <PlanSummary plan={selectedPlan} />}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeOrganizationModal}
                className="px-4 py-2 rounded-md border border-slate-700"
              >
                Cancel
              </button>
              <button
                disabled={saving || !form.plan_slug}
                className="px-4 py-2 rounded-md bg-indigo-600 font-semibold disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save organization"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Administrator Modal */}
      {adminOrg && (
        <Modal
          title={`Add administrator to ${adminOrg.name}`}
          onClose={() => {
            setAdminOrg(null);
            setError("");
          }}
        >
          <form onSubmit={createAdmin} className="space-y-4">
            {error && <Notice error>{error}</Notice>}

            <div className="p-3 bg-slate-950/60 rounded-md border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
              <span>Current Admins in Organization:</span>
              <strong
                className={`font-bold ${adminOrg.admin_count >= adminOrg.max_admins
                    ? "text-rose-400"
                    : "text-emerald-400"
                  }`}
              >
                {adminOrg.admin_count} / {adminOrg.max_admins}
              </strong>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {Object.keys(admin).map((key) => (
                <label key={key} className="text-xs text-slate-400">
                  {key[0].toUpperCase() + key.slice(1)}
                  <input
                    className="mt-1 w-full"
                    required
                    type={
                      key === "password"
                        ? "password"
                        : key === "email"
                          ? "email"
                          : "text"
                    }
                    value={admin[key]}
                    onChange={(event) =>
                      setAdmin({ ...admin, [key]: event.target.value })
                    }
                  />
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setAdminOrg(null);
                  setError("");
                }}
                className="px-4 py-2 rounded-md border border-slate-700"
              >
                Cancel
              </button>
              <button
                disabled={saving}
                className="px-4 py-2 rounded-md bg-indigo-600 font-semibold disabled:opacity-50"
              >
                Create administrator
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* View Users Modal */}
      {viewUsersOrg && (
        <Modal
          title={`Team & Admins - ${viewUsersOrg.name}`}
          onClose={() => {
            setViewUsersOrg(null);
            setPasswordTarget(null);
            setEditingRole(null);
            setError("");
          }}
        >
          <div className="space-y-4">
            {error && <Notice error>{error}</Notice>}

            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>
                Admins:{" "}
                <strong className="text-slate-200">
                  {viewUsersOrg.admin_count}/{viewUsersOrg.max_admins}
                </strong>
              </span>
              <span>
                Members:{" "}
                <strong className="text-slate-200">
                  {viewUsersOrg.user_count}/{viewUsersOrg.max_users}
                </strong>
              </span>
            </div>

            {/* Password reset inline form */}
            {passwordTarget && (
              <form onSubmit={handleSetPassword} className="p-3 bg-slate-950/60 border border-amber-500/30 rounded-md space-y-3">
                <div className="flex items-center gap-2 text-xs text-amber-300">
                  <Shield className="w-3.5 h-3.5" />
                  Reset password for <strong>{passwordTarget.name || passwordTarget.username}</strong> - sessions will be revoked.
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    required
                    placeholder="New temporary password"
                    className="flex-1 text-sm"
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                  />
                  <button className="px-3 py-1.5 rounded-md bg-amber-600 text-xs font-semibold">Set</button>
                  <button type="button" onClick={() => { setPasswordTarget(null); setTempPassword(""); }} className="px-3 py-1.5 rounded-md border border-slate-700 text-xs">Cancel</button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto border border-slate-800 rounded-md">
              <table>
                <thead>
                  <tr>
                    <th>Name / Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orgUsers.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="font-medium text-slate-200">
                          {u.name || u.username}
                        </div>
                        <div className="text-xs text-slate-500">
                          @{u.username}
                        </div>
                      </td>
                      <td>{u.email}</td>
                      <td>
                        {editingRole?.userId === u.id ? (
                          <CustomSelect
                            value={editingRole.role}
                            onChange={(role) => handleRoleChange(u.id, role)}
                            options={[
                              { value: "admin", label: "Admin" },
                              { value: "manager", label: "Manager" },
                              { value: "operator", label: "Operator" },
                              { value: "viewer", label: "Viewer" },
                            ]}
                            ariaLabel="Change role"
                            className="w-28"
                          />
                        ) : (
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-xs uppercase font-semibold cursor-pointer ${u.role === "admin"
                                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                                : "bg-slate-800 text-slate-300"
                              }`}
                            onClick={() => setEditingRole({ userId: u.id, role: u.role })}
                            title="Click to change role"
                          >
                            {u.role}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${u.is_active ? "bg-emerald-400/10 text-emerald-300" : "bg-slate-500/10 text-slate-400"}`}>
                          {u.is_active ? "active" : "inactive"}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <IconButton
                            title="Reset password"
                            onClick={() => {
                              setPasswordTarget(u);
                              setTempPassword("");
                              setError("");
                            }}
                            tone="warning"
                          >
                            <Key />
                          </IconButton>
                          {u.is_active && u.can_deactivate && (
                            <IconButton
                              title="Deactivate"
                              onClick={() => toggleUserActive(u)}
                              tone="warning"
                            >
                              <UserX />
                            </IconButton>
                          )}
                          {!u.is_active && (
                            <IconButton
                              title="Reactivate"
                              onClick={() => toggleUserActive(u)}
                              tone="success"
                            >
                              <UserCheck />
                            </IconButton>
                          )}
                          {(u.active_session_count || 0) > 0 && (
                            <IconButton
                              title="Revoke sessions"
                              onClick={() => handleRevokeUserSessions(u)}
                              tone="warning"
                            >
                              <LogOut />
                            </IconButton>
                          )}
                          {u.can_delete && (
                            <IconButton
                              title="Delete user"
                              onClick={() => deleteOrgUser(u.id)}
                              tone="warning"
                            >
                              <Trash2 />
                            </IconButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {!loadingUsers && orgUsers.length === 0 && (
                    <tr>
                      <td
                        colSpan="5"
                        className="py-8 text-center text-slate-500"
                      >
                        No users found for this organization.
                      </td>
                    </tr>
                  )}

                  {loadingUsers && (
                    <tr>
                      <td
                        colSpan="5"
                        className="py-8 text-center text-slate-500"
                      >
                        Loading team members…
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setViewUsersOrg(null);
                  setPasswordTarget(null);
                  setEditingRole(null);
                  setError("");
                }}
                className="px-4 py-2 rounded-md border border-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Organization Status Toggle Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(statusConfirmOrg)}
        title={`${statusConfirmOrg?.status === "active" ? "Suspend" : "Reactivate"} Organization`}
        message={`Are you sure you want to ${statusConfirmOrg?.status === "active" ? "suspend" : "reactivate"} ${statusConfirmOrg?.name}?`}
        confirmLabel={statusConfirmOrg?.status === "active" ? "Suspend" : "Reactivate"}
        isDanger={statusConfirmOrg?.status === "active"}
        onCancel={() => setStatusConfirmOrg(null)}
        onConfirm={confirmToggleStatus}
      />

      {/* Organization User Deletion Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteUserTarget)}
        title="Delete User Account"
        message="Are you sure you want to permanently delete this user? Consider deactivating instead."
        confirmLabel="Delete User"
        isDanger
        onCancel={() => setDeleteUserTarget(null)}
        onConfirm={confirmDeleteOrgUser}
      />
  </>;
}

function PlanSummary({ plan }) {
  const items = [
    `${plan.max_admins} administrators`,
    `${plan.max_users} users`,
    `${plan.max_smtp_accounts} SMTP accounts + support inboxes`,
    `${new Intl.NumberFormat().format(plan.max_recipients)} recipients`,
    `${new Intl.NumberFormat().format(plan.email_limit)} emails / 30 days`,
    `${plan.max_campaigns_per_day} campaigns / day`,
  ];

  return (
    <div className="border border-indigo-500/20 bg-indigo-500/5 p-4 rounded-md">
      <div className="flex items-center justify-between gap-3">
        <strong className="text-sm text-indigo-200">{plan.name} limits</strong>
        <span className="text-sm font-semibold">
          {plan.is_free
            ? "Free"
            : `৳${new Intl.NumberFormat().format(plan.price_bdt)}`}
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-2 mt-3">
        {items.map((item) => (
          <span
            key={item}
            className="flex items-center gap-2 text-xs text-slate-400"
          >
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function Status({ value }) {
  return (
    <span
      className={`inline-flex px-2 py-1 rounded text-xs ${value === "active"
          ? "bg-emerald-400/10 text-emerald-300"
          : "bg-amber-400/10 text-amber-300"
        }`}
    >
      {value}
    </span>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-md">
        <div className="sticky top-0 z-10 bg-slate-900 flex items-center justify-between p-5 border-b border-slate-800">
          <h3 className="font-semibold">{title}</h3>
          <button
            type="button"
            title="Close"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function IconButton({ title, onClick, tone = "default", children }) {
  const colors = {
    default: "text-indigo-300",
    warning: "text-amber-300",
    success: "text-emerald-300",
  };

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`p-2 rounded hover:bg-slate-800 ${colors[tone]}`}
    >
      <span className="[&>svg]:w-4 [&>svg]:h-4">{children}</span>
    </button>
  );
}

export function Notice({ children, error }) {
  return (
    <div
      className={`p-3 border rounded-md text-sm ${error
          ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
          : "border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
        }`}
    >
      {children}
    </div>
  );
}

