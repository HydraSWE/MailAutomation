import { useEffect, useMemo, useState } from "react";
import usersApi from "../../../services/usersApi";
import api from "../../../services/api";
import { apiError } from "../../../utils/apiError";

const ROLES = [{ value: "admin", label: "Admin" }, { value: "manager", label: "Manager" }, { value: "operator", label: "Operator" }, { value: "viewer", label: "Viewer" }];
const emptyForm = { name: "", email: "", username: "", password: "", role: "operator", organization: "" };

export function useUsersWorkspace() {
  const [users, setUsers] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [filterOrg, setFilterOrg] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Modals
  const [userModal, setUserModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [passwordModal, setPasswordModal] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    try {
      const params = {};
      if (filterOrg) params.organization = filterOrg;
      if (filterRole) params.role = filterRole;
      if (filterStatus === "active") params.is_active = true;
      if (filterStatus === "inactive") params.is_active = false;

      const [userRes, orgRes] = await Promise.all([
        usersApi.listUsers(params),
        api.get("/organizations/"),
      ]);
      const rawUsers = userRes.data?.results ?? userRes.data;
      const rawOrgs = orgRes.data?.results ?? orgRes.data;
      setUsers(Array.isArray(rawUsers) ? rawUsers : []);
      setOrganizations(Array.isArray(rawOrgs) ? rawOrgs : []);
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to load data.");
      setUsers([]);
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filterOrg, filterRole, filterStatus]);

  const filtered = useMemo(() => {
    const list = Array.isArray(users) ? users : [];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(
      (u) =>
        (u?.name || "").toLowerCase().includes(q) ||
        (u?.email || "").toLowerCase().includes(q) ||
        (u?.username || "").toLowerCase().includes(q)
    );
  }, [users, search]);

  const [editingUser, setEditingUser] = useState(null);

  function openCreate() {
    setEditing(null);
    setEditingUser(null);
    setForm(emptyForm);
    setUserModal(true);
    setError("");
  }

  function openEdit(user) {
    setEditing(user.id);
    setEditingUser(user);
    setForm({
      name: user.name || "",
      email: user.email,
      username: user.username,
      password: "",
      role: user.role,
      organization: user.organization || "",
    });
    setUserModal(true);
    setError("");
  }

  function closeUserModal() {
    setUserModal(false);
    setEditing(null);
    setEditingUser(null);
    setForm(emptyForm);
  }

  async function saveUser(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      if (payload.organization) payload.organization = Number(payload.organization);
      if (editing) {
        await usersApi.updateUser(editing, payload);
        setMessage("User updated.");
      } else {
        await usersApi.createUser(payload);
        setMessage("User created.");
      }
      closeUserModal();
      await load();
    } catch (e) {
      setError(apiError(e, "Unable to save user."));
    } finally {
      setSaving(false);
    }
  }

  async function handleSetPassword(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await usersApi.setPassword(passwordModal.id, newPassword);
      setMessage("Password updated and sessions revoked.");
      setPasswordModal(null);
      setNewPassword("");
      await load();
    } catch (e) {
      setError(apiError(e, "Unable to reset password."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await usersApi.deleteUser(deleteTarget.id);
      setMessage("User deleted.");
      setDeleteTarget(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to delete user.");
    }
  }

  async function toggleActive(user) {
    setError("");
    try {
      if (user.is_active) {
        await usersApi.deactivateUser(user.id);
        setMessage(`${user.name || user.username} deactivated.`);
      } else {
        await usersApi.reactivateUser(user.id);
        setMessage(`${user.name || user.username} reactivated.`);
      }
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to update status.");
    }
  }

  async function handleRevokeSessions(user) {
    setError("");
    try {
      const res = await usersApi.revokeSessions(user.id);
      setMessage(res.data.detail || "Sessions revoked.");
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to revoke sessions.");
    }
  }

  const [reset2FATarget, setReset2FATarget] = useState(null);

  function handleReset2FA(user) {
    setReset2FATarget(user);
  }

  async function confirmReset2FA() {
    if (!reset2FATarget) return;
    const user = reset2FATarget;
    setReset2FATarget(null);
    setError("");
    try {
      await usersApi.resetUser2FA(user.id);
      setMessage(`2FA has been reset for ${user.name || user.username}.`);
      await load();
      if (editing && editingUser?.id === user.id) {
        setEditingUser((prev) => (prev ? { ...prev, two_factor_enabled: false } : prev));
      }
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to reset 2FA.");
    }
  }

  const roleBadge = (role) => {
    const colors = {
      admin: "bg-rose-500/10 text-rose-400 border-rose-500/30",
      manager: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
      operator: "bg-sky-500/10 text-sky-400 border-sky-500/30",
      viewer: "bg-slate-500/10 text-slate-400 border-slate-500/30",
    };
    return (
      <span
        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
          colors[role] || colors.viewer
        }`}
      >
        {role}
      </span>
    );
  };

  return { users, organizations, loading, saving, message, error, setError, search, setSearch, filterOrg, setFilterOrg, filterRole, setFilterRole, filterStatus, setFilterStatus, userModal, editing, form, setForm, passwordModal, setPasswordModal, newPassword, setNewPassword, deleteTarget, setDeleteTarget, reset2FATarget, setReset2FATarget, confirmReset2FA, filtered, editingUser, setEditingUser, openCreate, openEdit, closeUserModal, saveUser, handleSetPassword, handleDelete, toggleActive, handleRevokeSessions, handleReset2FA, roleBadge };
}
