import { Plus } from "lucide-react";
import { useOrganizationsWorkspace } from "./useOrganizationsWorkspace";
import OrganizationsFilters from "./OrganizationsFilters";
import OrganizationsTable from "./OrganizationsTable";
import OrganizationDialogs, { Notice } from "./OrganizationDialogs";

export default function PlatformOrganizations() {
  const {
    organizations, plans, form, setForm, editing, organizationModal, adminOrg, setAdminOrg,
    admin, setAdmin, viewUsersOrg, setViewUsersOrg, orgUsers, loadingUsers, search, setSearch,
    status, setStatus, message, error, setError, loading, saving, editingRole, setEditingRole, passwordTarget,
    setPasswordTarget, tempPassword, setTempPassword, filtered, selectedPlan, statusConfirmOrg,
    setStatusConfirmOrg, confirmToggleStatus, deleteUserTarget, setDeleteUserTarget, confirmDeleteOrgUser,
    openCreate, openEdit, closeOrganizationModal, openViewUsers, saveOrganization, toggleStatus,
    toggleSupportWorkspace, createAdmin, deleteOrgUser, handleRoleChange, handleSetPassword,
    toggleUserActive, handleRevokeUserSessions,
  } = useOrganizationsWorkspace();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Organizations</h2>
          <p className="text-sm text-slate-500 mt-1">
            Assign a plan to provision every tenant limit and its 30-day
            subscription.
          </p>
        </div>

        <button
          onClick={openCreate}
          disabled={!plans.some((plan) => plan.is_active)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-indigo-600 text-sm font-semibold disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> New organization
        </button>
      </div>

      {/* Notices */}
      {message && <Notice>{message}</Notice>}
      {error && !organizationModal && !adminOrg && !viewUsersOrg && (
        <Notice error>{error}</Notice>
      )}

      <OrganizationsFilters search={search} setSearch={setSearch} status={status} setStatus={setStatus} />

      <OrganizationsTable organizations={organizations} filtered={filtered} loading={loading} toggleSupportWorkspace={toggleSupportWorkspace} openViewUsers={openViewUsers} openEdit={openEdit} toggleStatus={toggleStatus} setAdminOrg={setAdminOrg} setError={setError} />

      <OrganizationDialogs organizationModal={organizationModal} editing={editing} closeOrganizationModal={closeOrganizationModal} saveOrganization={saveOrganization} error={error} setError={setError} form={form} setForm={setForm} plans={plans} selectedPlan={selectedPlan} saving={saving} adminOrg={adminOrg} setAdminOrg={setAdminOrg} createAdmin={createAdmin} admin={admin} setAdmin={setAdmin} viewUsersOrg={viewUsersOrg} setViewUsersOrg={setViewUsersOrg} loadingUsers={loadingUsers} orgUsers={orgUsers} editingRole={editingRole} setEditingRole={setEditingRole} handleRoleChange={handleRoleChange} passwordTarget={passwordTarget} setPasswordTarget={setPasswordTarget} tempPassword={tempPassword} setTempPassword={setTempPassword} handleSetPassword={handleSetPassword} toggleUserActive={toggleUserActive} handleRevokeUserSessions={handleRevokeUserSessions} deleteOrgUser={deleteOrgUser} statusConfirmOrg={statusConfirmOrg} setStatusConfirmOrg={setStatusConfirmOrg} confirmToggleStatus={confirmToggleStatus} deleteUserTarget={deleteUserTarget} setDeleteUserTarget={setDeleteUserTarget} confirmDeleteOrgUser={confirmDeleteOrgUser} />
    </div>
  );
}
