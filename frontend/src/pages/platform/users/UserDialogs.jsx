import { AlertTriangle, Loader2, Shield, ShieldCheck, ShieldOff, X } from "lucide-react";
import CustomSelect from "../../../components/common/CustomSelect";
import ConfirmDialog from "../../../components/common/ConfirmDialog";

const ROLES = [{ value: "admin", label: "Admin" }, { value: "manager", label: "Manager" }, { value: "operator", label: "Operator" }, { value: "viewer", label: "Viewer" }];

export default function UserDialogs({ userModal, editing, closeUserModal, saveUser, error, setError, form, setForm, organizations, saving, editingUser, setEditingUser, handleReset2FA, passwordModal, setPasswordModal, newPassword, setNewPassword, handleSetPassword, deleteTarget, setDeleteTarget, handleDelete, reset2FATarget, setReset2FATarget, confirmReset2FA }) {
  return <>
      {/* Add / Edit User Modal */}
      {userModal && (
        <Modal
          title={editing ? "Edit user" : "Add user"}
          onClose={closeUserModal}
        >
          <form onSubmit={saveUser} className="space-y-4">
            {error && <Notice error>{error}</Notice>}

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Full name">
                <input
                  type="text"
                  className="mt-1 w-full"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Email address">
                <input
                  type="email"
                  required
                  className="mt-1 w-full"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
              <Field label="Username">
                <input
                  type="text"
                  className="mt-1 w-full"
                  placeholder="Auto-generated from email if empty"
                  value={form.username}
                  onChange={(e) =>
                    setForm({ ...form, username: e.target.value })
                  }
                />
              </Field>
              <Field label="Password">
                <input
                  type="password"
                  className="mt-1 w-full"
                  placeholder={editing ? "Leave blank to keep" : "Required"}
                  required={!editing}
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                />
              </Field>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Organization">
                <CustomSelect
                  className="mt-1"
                  value={String(form.organization)}
                  onChange={(val) =>
                    setForm({ ...form, organization: val })
                  }
                  options={[
                    { value: "", label: "Select organization" },
                    ...organizations.map((o) => ({
                      value: String(o.id),
                      label: o.name,
                    })),
                  ]}
                  ariaLabel="Organization"
                />
              </Field>
              <Field label="Role">
                <CustomSelect
                  className="mt-1"
                  value={form.role}
                  onChange={(role) => setForm({ ...form, role })}
                  options={ROLES}
                  ariaLabel="Role"
                />
              </Field>
            </div>

            {/* 2FA Security in Edit User Modal */}
            {editing && editingUser && (
              <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Shield className={`w-4 h-4 ${editingUser.two_factor_enabled ? "text-emerald-400" : "text-slate-500"}`} />
                  <div>
                    <p className="text-xs font-semibold text-slate-200">Two-Factor Authentication (2FA)</p>
                    <p className="text-[11px] text-slate-400">
                      {editingUser.two_factor_enabled
                        ? "Authenticator app is active for this account."
                        : "2FA is not enabled for this user."}
                    </p>
                  </div>
                </div>
                {editingUser.can_reset_2fa && (
                  <button
                    type="button"
                    onClick={() => handleReset2FA(editingUser)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-medium transition-colors"
                  >
                    <ShieldOff className="w-3.5 h-3.5" />
                    Reset 2FA
                  </button>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={closeUserModal}
                className="px-4 py-2 rounded-xl border border-slate-700 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-sm font-semibold disabled:opacity-50"
              >
                {saving ? "Saving…" : editing ? "Update user" : "Create user"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Reset Password Modal */}
      {passwordModal && (
        <Modal
          title={`Reset password - ${passwordModal.name || passwordModal.username}`}
          onClose={() => {
            setPasswordModal(null);
            setError("");
          }}
        >
          <form onSubmit={handleSetPassword} className="space-y-4">
            {error && <Notice error>{error}</Notice>}

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-sm text-amber-300 flex items-center gap-2">
              <Shield className="w-4 h-4 shrink-0" />
              Setting a new password will revoke all active sessions for this user.
            </div>

            <Field label="New temporary password">
              <input
                type="password"
                required
                className="mt-1 w-full"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setPasswordModal(null);
                  setError("");
                }}
                className="px-4 py-2 rounded-xl border border-slate-700 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-amber-600 text-sm font-semibold disabled:opacity-50"
              >
                {saving ? "Setting…" : "Set password"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete user"
        message={`Are you sure you want to permanently delete ${
          deleteTarget?.name || deleteTarget?.username
        }? This action cannot be undone. Consider deactivating instead.`}
        confirmLabel="Delete permanently"
        isDanger
      />

      {/* Reset 2FA Confirmation */}
      <ConfirmDialog
        isOpen={!!reset2FATarget}
        onCancel={() => setReset2FATarget(null)}
        onConfirm={confirmReset2FA}
        title="Reset user 2FA"
        message={`Are you sure you want to reset 2FA for ${
          reset2FATarget?.name || reset2FATarget?.username
        }? Their authenticator secret and backup codes will be cleared immediately.`}
        confirmLabel="Reset 2FA"
        isDanger
      />
  </>;
}

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
        active
          ? "bg-emerald-400/10 text-emerald-300 border border-emerald-500/30"
          : "bg-slate-500/10 text-slate-400 border border-slate-600/30"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl">
        <div className="sticky top-0 z-10 bg-slate-900 flex items-center justify-between p-5 border-b border-slate-800">
          <h3 className="font-semibold text-slate-100">{title}</h3>
          <button
            type="button"
            title="Close"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block text-xs font-semibold text-slate-400">
      {label}
      {children}
    </label>
  );
}

function IconBtn({ title, onClick, tone = "default", children }) {
  const colors = {
    default: "text-indigo-300 hover:bg-indigo-500/10",
    warning: "text-amber-300 hover:bg-amber-500/10",
    success: "text-emerald-300 hover:bg-emerald-500/10",
    danger: "text-rose-300 hover:bg-rose-500/10",
  };
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`p-2 rounded-lg transition-colors ${colors[tone]}`}
    >
      <span className="[&>svg]:w-4 [&>svg]:h-4">{children}</span>
    </button>
  );
}

export function Notice({ children, error }) {
  return (
    <div
      className={`p-3 border rounded-xl text-sm ${
        error
          ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
          : "border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
      }`}
    >
      {children}
    </div>
  );
}

