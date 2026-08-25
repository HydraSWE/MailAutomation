import { Plus, Shield } from "lucide-react";
import DataTable from "../../../components/common/DataTable";
import FormModal from "../../../components/common/FormModal";
import ConfirmDialog from "../../../components/common/ConfirmDialog";
import CustomSelect from "../../../components/common/CustomSelect";

export default function UsersRolesTab({ users, usersLoading, seatUsage, userColumns, userModal, userData, setUserData, onSaveUser, passwordResetModal, resetPassword, setResetPassword, onResetPassword, deleteUserModal, onDeleteUser, reset2FAModal, onConfirmResetUser2FA }) {
  return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-100">User Management & Permissions</h3>
              <p className="text-xs text-slate-400">Manage user accounts and grant role permissions (Admin, Manager, Operator, Viewer).</p>
            </div>
            <button
              onClick={() => {
                setUserData({ name: "", email: "", role: "operator", password: "" });
                userModal.openModal();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/25"
            >
              <Plus className="w-4 h-4" />
              Add User
            </button>
          </div>

          {/* Seat Usage */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
              <p className="text-xs uppercase text-slate-400">Admin seats</p>
              <p className="text-xl font-bold mt-1">
                {seatUsage.admins} <span className="text-sm text-slate-500">/ {seatUsage.maxAdmins || "-"}</span>
              </p>
              {seatUsage.maxAdmins > 0 && (
                <p className="text-xs text-indigo-400 mt-1">
                  {Math.max(seatUsage.maxAdmins - seatUsage.admins, 0)} remaining
                </p>
              )}
            </div>
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
              <p className="text-xs uppercase text-slate-400">User seats</p>
              <p className="text-xl font-bold mt-1">
                {seatUsage.users} <span className="text-sm text-slate-500">/ {seatUsage.maxUsers || "-"}</span>
              </p>
              {seatUsage.maxUsers > 0 && (
                <p className="text-xs text-indigo-400 mt-1">
                  {Math.max(seatUsage.maxUsers - seatUsage.users, 0)} remaining
                </p>
              )}
            </div>
          </div>

          {/* Role Permissions Matrix Summary */}
          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Role Permissions Matrix Overview</h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <p className="font-bold text-rose-400">Admin</p>
                <p className="text-[11px] text-slate-400 mt-1">Full access to users, recipients, SMTP, campaigns, reports, and settings.</p>
              </div>
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <p className="font-bold text-indigo-400">Manager</p>
                <p className="text-[11px] text-slate-400 mt-1">Manage recipients, templates, SMTP accounts, launch campaigns, view reports.</p>
              </div>
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <p className="font-bold text-sky-400">Operator</p>
                <p className="text-[11px] text-slate-400 mt-1">Manage recipients, draft templates, create campaign drafts, view reports.</p>
              </div>
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <p className="font-bold text-slate-400">Viewer</p>
                <p className="text-[11px] text-slate-400 mt-1">Read-only access to campaign reports and analytics charts.</p>
              </div>
            </div>
          </div>

          <DataTable columns={userColumns} data={users} loading={usersLoading} emptyTitle="No users configured" />

          {/* User Form Modal */}
          <FormModal
            isOpen={userModal.isOpen}
            onClose={userModal.closeModal}
            title={userModal.data ? "Edit User" : "Add User Account"}
          >
            <form onSubmit={onSaveUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  value={userData.name}
                  onChange={(e) => setUserData({ ...userData, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3.5 py-2 text-sm text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={userData.email}
                  onChange={(e) => setUserData({ ...userData, email: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3.5 py-2 text-sm text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  placeholder={userModal.data ? "Leave blank to keep current" : "Required"}
                  required={!userModal.data}
                  value={userData.password}
                  onChange={(e) => setUserData({ ...userData, password: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3.5 py-2 text-sm text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">System Role</label>
                <CustomSelect
                  value={userData.role}
                  onChange={(role) => setUserData({ ...userData, role })}
                  options={[
                    { value: "admin", label: "Admin" },
                    { value: "manager", label: "Manager" },
                    { value: "operator", label: "Operator" },
                    { value: "viewer", label: "Viewer" },
                  ]}
                  ariaLabel="System role"
                />
              </div>
              <div className="flex justify-end pt-4 border-t border-slate-800">
                <button type="button" onClick={userModal.closeModal} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm font-medium">
                  Cancel
                </button>
                <button type="submit" className="ml-2 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium">
                  Save User
                </button>
              </div>
            </form>
          </FormModal>

          {/* Password Reset Modal */}
          <FormModal
            isOpen={passwordResetModal.isOpen}
            onClose={() => { passwordResetModal.closeModal(); setResetPassword(""); }}
            title={`Reset password: ${passwordResetModal.data?.name || passwordResetModal.data?.email || ""}`}
          >
            <form onSubmit={onResetPassword} className="space-y-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-sm text-amber-300 flex items-center gap-2">
                <Shield className="w-4 h-4 shrink-0" />
                Setting a new password will revoke all active sessions for this user.
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">New Temporary Password</label>
                <input
                  type="password"
                  required
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3.5 py-2 text-sm text-slate-100"
                />
              </div>
              <div className="flex justify-end pt-4 border-t border-slate-800">
                <button type="button" onClick={() => { passwordResetModal.closeModal(); setResetPassword(""); }} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm font-medium">
                  Cancel
                </button>
                <button type="submit" className="ml-2 px-5 py-2 bg-amber-600 text-white rounded-xl text-sm font-medium">
                  Set Password
                </button>
              </div>
            </form>
          </FormModal>

          <ConfirmDialog
            isOpen={deleteUserModal.isOpen}
            onCancel={deleteUserModal.closeModal}
            onConfirm={onDeleteUser}
            title="Delete User Account"
            message={`Are you sure you want to permanently delete ${deleteUserModal.data?.name || deleteUserModal.data?.email}? This action cannot be undone. Consider deactivating the user instead.`}
            confirmLabel="Delete User"
            isDanger={true}
          />

          <ConfirmDialog
            isOpen={reset2FAModal?.isOpen}
            onCancel={reset2FAModal?.closeModal}
            onConfirm={onConfirmResetUser2FA}
            title="Reset User 2FA"
            message={`Are you sure you want to reset 2FA for ${reset2FAModal?.data?.name || reset2FAModal?.data?.email}? Their authenticator secret and backup codes will be cleared, allowing them to sign in or re-enroll.`}
            confirmLabel="Reset 2FA"
            isDanger={true}
          />
        </div>
  );
}

