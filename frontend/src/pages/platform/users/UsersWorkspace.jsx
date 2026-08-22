import { useEffect, useMemo, useState } from "react";
import {
  Edit2,
  Key,
  Loader2,
  LogOut,
  Plus,
  Power,
  Search,
  Shield,
  ShieldCheck,
  ShieldOff,
  AlertTriangle,
  Trash2,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import usersApi from "../../../services/usersApi";
import api from "../../../services/api";
import CustomSelect from "../../../components/common/CustomSelect";
import SearchInput from "../../../components/common/SearchInput";
import ConfirmDialog from "../../../components/common/ConfirmDialog";
import { apiError } from "../../../utils/apiError";
import { useUsersWorkspace } from "./useUsersWorkspace";
import UsersFilters from "./UsersFilters";
import UsersTable from "./UsersTable";
import UserDialogs, { Notice } from "./UserDialogs";

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "operator", label: "Operator" },
  { value: "viewer", label: "Viewer" },
];

const emptyForm = {
  name: "",
  email: "",
  username: "",
  password: "",
  role: "operator",
  organization: "",
};

export default function PlatformUsers() {
  const {
    users, organizations, loading, saving, message, error, setError, search, setSearch, filterOrg, setFilterOrg,
    filterRole, setFilterRole, filterStatus, setFilterStatus, userModal, editing, form, setForm,
    passwordModal, setPasswordModal, newPassword, setNewPassword, deleteTarget, setDeleteTarget,
    filtered, editingUser, setEditingUser, openCreate, openEdit, closeUserModal, saveUser,
    handleSetPassword, handleDelete, toggleActive, handleRevokeSessions, handleReset2FA, roleBadge,
  } = useUsersWorkspace();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Users</h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage all platform users across organizations.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-sm font-semibold shadow-lg shadow-indigo-600/25 hover:bg-indigo-500 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add user
        </button>
      </div>

      {/* Notices */}
      {message && <Notice>{message}</Notice>}
      {error && !userModal && !passwordModal && (
        <Notice error>{error}</Notice>
      )}

      <UsersFilters search={search} setSearch={setSearch} organization={filterOrg} setOrganization={setFilterOrg} role={filterRole} setRole={setFilterRole} status={filterStatus} setStatus={setFilterStatus} organizations={organizations} />

      <UsersTable users={users} filtered={filtered} loading={loading} roleBadge={roleBadge} openEdit={openEdit} setPasswordModal={setPasswordModal} setNewPassword={setNewPassword} setError={setError} reset2FA={handleReset2FA} toggleActive={toggleActive} revokeSessions={handleRevokeSessions} setDeleteTarget={setDeleteTarget} />

      <UserDialogs userModal={userModal} editing={editing} closeUserModal={closeUserModal} saveUser={saveUser} error={error} setError={setError} form={form} setForm={setForm} organizations={organizations} saving={saving} editingUser={editingUser} setEditingUser={setEditingUser} handleReset2FA={handleReset2FA} passwordModal={passwordModal} setPasswordModal={setPasswordModal} newPassword={newPassword} setNewPassword={setNewPassword} handleSetPassword={handleSetPassword} deleteTarget={deleteTarget} setDeleteTarget={setDeleteTarget} handleDelete={handleDelete} />
    </div>
  );
}
