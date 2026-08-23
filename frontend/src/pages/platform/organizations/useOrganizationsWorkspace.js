import { useEffect, useMemo, useState } from "react";
import api from "../../../services/api";
import usersApi from "../../../services/usersApi";
import { apiError } from "../../../utils/apiError";

const emptyOrganization = { name: "", plan_slug: "" };

export function useOrganizationsWorkspace() {
  const [organizations, setOrganizations] = useState([]);
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState(emptyOrganization);
  const [editing, setEditing] = useState(null);
  const [organizationModal, setOrganizationModal] = useState(false);
  const [adminOrg, setAdminOrg] = useState(null);
  const [admin, setAdmin] = useState({
    name: "",
    email: "",
    username: "",
    password: "",
  });
  const [viewUsersOrg, setViewUsersOrg] = useState(null);
  const [orgUsers, setOrgUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // User modal action state
  const [editingRole, setEditingRole] = useState(null); // { userId, role }
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [tempPassword, setTempPassword] = useState("");

  const load = () =>
    Promise.all([
      api.get("/organizations/"),
      api.get("/billing/platform/plans/"),
    ]).then(([orgResponse, planResponse]) => {
      const rawOrgs = orgResponse.data?.results ?? orgResponse.data;
      const rawPlans = planResponse.data?.results ?? planResponse.data;
      setOrganizations(Array.isArray(rawOrgs) ? rawOrgs : []);
      setPlans(Array.isArray(rawPlans) ? rawPlans : []);
    });

  useEffect(() => {
    load()
      .catch((requestError) => {
        setError(
          requestError.response?.data?.detail || "Unable to load organizations."
        );
        setOrganizations([]);
        setPlans([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => {
      const list = Array.isArray(organizations) ? organizations : [];
      return list.filter(
        (org) =>
          (status === "all" || org?.status === status) &&
          (org?.name || "").toLowerCase().includes(search.toLowerCase())
      );
    },
    [organizations, status, search]
  );

  const selectedPlan = plans.find((plan) => plan.slug === form.plan_slug);

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      plan_slug: plans.find((plan) => plan.is_active)?.slug || "",
    });
    setOrganizationModal(true);
    setMessage("");
    setError("");
  }

  function openEdit(org) {
    setEditing(org.id);
    setForm({ name: org.name, plan_slug: org.subscription?.plan || "" });
    setOrganizationModal(true);
    setError("");
  }

  function closeOrganizationModal() {
    setOrganizationModal(false);
    setEditing(null);
    setForm(emptyOrganization);
  }

  async function openViewUsers(org) {
    setViewUsersOrg(org);
    setLoadingUsers(true);
    setError("");

    try {
      const response = await api.get(`/users/?organization=${org.id}`);
      setOrgUsers(response.data.results || response.data);
    } catch (e) {
      setError(
        e.response?.data?.detail || "Unable to fetch organization users."
      );
    } finally {
      setLoadingUsers(false);
    }
  }

  async function saveOrganization(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (editing) {
        await api.patch(`/organizations/${editing}/`, form);
      } else {
        await api.post("/organizations/", form);
      }
      closeOrganizationModal();
      setMessage("Organization and subscription saved.");
      await load();
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
        JSON.stringify(
          requestError.response?.data || "Unable to save organization."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(org) {
    const action = org.status === "active" ? "suspend" : "reactivate";
    if (
      !window.confirm(
        `${action === "suspend" ? "Suspend" : "Reactivate"} ${org.name}?`
      )
    ) {
      return;
    }

    try {
      await api.post(`/organizations/${org.id}/${action}/`);
      setMessage(
        `Organization ${action === "suspend" ? "suspended" : "reactivated"}.`
      );
      await load();
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
        "Unable to update organization status."
      );
    }
  }

  async function toggleSupportWorkspace(org) {
    if (!org.support_workspace_available && !org.support_workspace_enabled) {
      setError("Mail workspace is available only on Premium+ and Custom plans.");
      return;
    }
    setError("");
    try {
      await api.post(`/organizations/${org.id}/toggle-support-workspace/`, {
        enabled: !org.support_workspace_enabled,
      });
      setMessage(`Mail workspace ${org.support_workspace_enabled ? "hidden from" : "enabled for"} ${org.name}.`);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to update support workspace access.");
    }
  }

  async function createAdmin(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await api.post(`/organizations/${adminOrg.id}/create-admin/`, admin);
      setAdminOrg(null);
      setAdmin({ name: "", email: "", username: "", password: "" });
      setMessage("Organization administrator created.");
      await load();
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
        JSON.stringify(
          requestError.response?.data || "Unable to create administrator."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteOrgUser(userId) {
    if (
      !window.confirm(
        "Are you sure you want to permanently delete this user? Consider deactivating instead."
      )
    ) {
      return;
    }

    try {
      await usersApi.deleteUser(userId);
      setOrgUsers((prev) => prev.filter((u) => u.id !== userId));
      setMessage("User deleted.");
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to delete user.");
    }
  }

  async function handleRoleChange(userId, newRole) {
    setError("");
    try {
      await usersApi.updateUser(userId, { role: newRole });
      setOrgUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      setEditingRole(null);
      setMessage("Role updated.");
      await load();
    } catch (e) {
      setError(apiError(e, "Unable to update role."));
    }
  }

  async function handleSetPassword(e) {
    e.preventDefault();
    setError("");
    try {
      await usersApi.setPassword(passwordTarget.id, tempPassword);
      setMessage("Password updated and sessions revoked.");
      setPasswordTarget(null);
      setTempPassword("");
      await openViewUsers(viewUsersOrg);
    } catch (e) {
      setError(apiError(e, "Unable to reset password."));
    }
  }

  async function toggleUserActive(user) {
    setError("");
    try {
      if (user.is_active) {
        await usersApi.deactivateUser(user.id);
        setMessage(`${user.name || user.username} deactivated.`);
      } else {
        await usersApi.reactivateUser(user.id);
        setMessage(`${user.name || user.username} reactivated.`);
      }
      await openViewUsers(viewUsersOrg);
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to update user status.");
    }
  }

  async function handleRevokeUserSessions(user) {
    setError("");
    try {
      const res = await usersApi.revokeSessions(user.id);
      setMessage(res.data.detail || "Sessions revoked.");
      await openViewUsers(viewUsersOrg);
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to revoke sessions.");
    }
  }


  return { organizations, plans, form, setForm, editing, organizationModal, adminOrg, setAdminOrg, admin, setAdmin, viewUsersOrg, setViewUsersOrg, orgUsers, loadingUsers, search, setSearch, status, setStatus, message, error, setError, loading, saving, editingRole, setEditingRole, passwordTarget, setPasswordTarget, tempPassword, setTempPassword, filtered, selectedPlan, openCreate, openEdit, closeOrganizationModal, openViewUsers, saveOrganization, toggleStatus, toggleSupportWorkspace, createAdmin, deleteOrgUser, handleRoleChange, handleSetPassword, toggleUserActive, handleRevokeUserSessions };
}

