import React from "react";
import {
  Sliders,
  Mail,
  Shield,
  Users,
  User,
} from "lucide-react";
import GeneralSettingsTab from "./GeneralSettingsTab";
import EmailSettingsTab from "./EmailSettingsTab";
import SecuritySettingsTab from "./SecuritySettingsTab";
import UsersRolesTab from "./UsersRolesTab";
import ProfileSettingsTab from "./ProfileSettingsTab";
import TwoFactorDialogs from "./TwoFactorDialogs";
import { useSettingsWorkspace } from "./useSettingsWorkspace";


export default function SettingsPage() {
  const {
    toast, activeTab, setActiveTab, saving, settings, setSettings, users, usersLoading,
    userModal, deleteUserModal, passwordResetModal, userData, setUserData, resetPassword,
    setResetPassword, seatUsage, profile, setProfile, profileSaving, handleSaveProfile,
    passwordForm, setPasswordForm, passwordSaving, handleUpdatePassword,
    showEmailModal, setShowEmailModal, emailStep, setEmailStep, newEmail, setNewEmail,
    emailPassword, setEmailPassword, emailOtp, setEmailOtp, emailLoading,
    handleOpenEmailModal, handleRequestEmailChange, handleConfirmEmailChange,
    twoFAStatus, showSetup2FA, setShowSetup2FA, setup2FAData, setup2FAStep, setSetup2FAStep,
    setup2FACode, setSetup2FACode, setup2FABackupCodes, setup2FALoading, showDisable2FA,
    setShowDisable2FA, disable2FAPassword, setDisable2FAPassword, showRegenCodes,
    setShowRegenCodes, regenPassword, setRegenPassword, regenCodes, setRegenCodes,
    twoFALoading, handleSaveSettings, handleSaveUser, handleDeleteUser,
    handleResetPassword, handleStart2FASetup, handleConfirm2FA,
    handleDisable2FA, handleRegenBackupCodes, copyBackupCodes, downloadBackupCodes, userColumns,
  } = useSettingsWorkspace();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Settings & Compliance</h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure application defaults, storage limits, security policy, and role permissions.
        </p>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-900/60 border border-slate-800 rounded-2xl">
        {[
          { id: "general", label: "General", icon: Sliders },
          { id: "email", label: "Email Defaults", icon: Mail },
          { id: "security", label: "Security", icon: Shield },
          { id: "users", label: "Users & Roles", icon: Users },
          { id: "profile", label: "My Profile", icon: User },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${isActive
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: General Settings */}
      {activeTab === "general" && <GeneralSettingsTab settings={settings} setSettings={setSettings} onSave={handleSaveSettings} saving={saving} />}

      {/* Tab 2: Email Settings */}
      {activeTab === "email" && <EmailSettingsTab settings={settings} setSettings={setSettings} onSave={handleSaveSettings} saving={saving} />}

      {/* Tab 3: Security Settings */}
      {activeTab === "security" && <SecuritySettingsTab settings={settings} setSettings={setSettings} onSave={handleSaveSettings} saving={saving} />}

      {/* Tab 5: Users & Role Settings */}
      {activeTab === "users" && <UsersRolesTab users={users} usersLoading={usersLoading} seatUsage={seatUsage} userColumns={userColumns} userModal={userModal} userData={userData} setUserData={setUserData} onSaveUser={handleSaveUser} passwordResetModal={passwordResetModal} resetPassword={resetPassword} setResetPassword={setResetPassword} onResetPassword={handleResetPassword} deleteUserModal={deleteUserModal} onDeleteUser={handleDeleteUser} />}

      {/* Tab 6: Profile Settings */}
      {activeTab === "profile" && (
        <ProfileSettingsTab
          profile={profile}
          setProfile={setProfile}
          profileSaving={profileSaving}
          onSaveProfile={handleSaveProfile}
          passwordForm={passwordForm}
          setPasswordForm={setPasswordForm}
          passwordSaving={passwordSaving}
          onUpdatePassword={handleUpdatePassword}
          showEmailModal={showEmailModal}
          setShowEmailModal={setShowEmailModal}
          emailStep={emailStep}
          setEmailStep={setEmailStep}
          newEmail={newEmail}
          setNewEmail={setNewEmail}
          emailPassword={emailPassword}
          setEmailPassword={setEmailPassword}
          emailOtp={emailOtp}
          setEmailOtp={setEmailOtp}
          emailLoading={emailLoading}
          onOpenEmailModal={handleOpenEmailModal}
          onRequestEmailChange={handleRequestEmailChange}
          onConfirmEmailChange={handleConfirmEmailChange}
          twoFAStatus={twoFAStatus}
          onStart2FASetup={handleStart2FASetup}
          setup2FALoading={setup2FALoading}
          setShowRegenCodes={setShowRegenCodes}
          setRegenPassword={setRegenPassword}
          setRegenCodes={setRegenCodes}
          setShowDisable2FA={setShowDisable2FA}
          setDisable2FAPassword={setDisable2FAPassword}
        />
      )}

      <TwoFactorDialogs showSetup2FA={showSetup2FA} setup2FAData={setup2FAData} setShowSetup2FA={setShowSetup2FA} setup2FAStep={setup2FAStep} setSetup2FAStep={setSetup2FAStep} setup2FACode={setup2FACode} setSetup2FACode={setSetup2FACode} onConfirm2FA={handleConfirm2FA} setup2FALoading={setup2FALoading} setup2FABackupCodes={setup2FABackupCodes} copyBackupCodes={copyBackupCodes} downloadBackupCodes={downloadBackupCodes} toast={toast} showDisable2FA={showDisable2FA} setShowDisable2FA={setShowDisable2FA} disable2FAPassword={disable2FAPassword} setDisable2FAPassword={setDisable2FAPassword} onDisable2FA={handleDisable2FA} twoFALoading={twoFALoading} showRegenCodes={showRegenCodes} setShowRegenCodes={setShowRegenCodes} regenCodes={regenCodes} regenPassword={regenPassword} setRegenPassword={setRegenPassword} onRegenBackupCodes={handleRegenBackupCodes} />
    </div>
  );
}
