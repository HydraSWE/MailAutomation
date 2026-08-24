import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Edit2, Key, LogOut, ShieldOff, Trash, UserCheck, UserX } from "lucide-react";
import settingsApi from "../../../services/settingsApi";
import usersApi from "../../../services/usersApi";
import twoFactorApi from "../../../services/twoFactorApi";
import { useModal } from "../../../hooks/useModal";
import { useToast } from "../../../hooks/useToast";
import { clearTokens, getUser, setUser as updateStoredUser } from "../../../utils/auth";
import { apiError } from "../../../utils/apiError";

export function useSettingsWorkspace() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const currentUser = getUser();

  const [activeTab, setActiveTab] = useState("general");
  const [saving, setSaving] = useState(false);

  // Settings State
  const [settings, setSettings] = useState({
    // General
    company_name: "Acme Enterprises Inc.",
    default_sender_name: "Marketing Team",
    default_sender_email: "marketing@acme.com",
    default_reply_to: "support@acme.com",
    default_timezone: "UTC",
    date_format: "YYYY-MM-DD",
    default_page_size: 10,

    // Email
    default_smtp: "",
    retry_count: 3,
    retry_delay_seconds: 300,
    batch_size: 50,
    delay_between_emails: 1,
    tracking_enabled: true,
    click_tracking: true,
    plaintext_fallback: true,
    unsubscribe_footer: "You are receiving this email because you opted into our newsletter. Click here to unsubscribe.",

    // Storage
    max_upload_size_mb: 25,
    allowed_image_formats: "jpg, png, gif, webp",
    allowed_attachment_formats: "pdf, docx, xlsx, zip",
    media_storage_path: "/var/mail_automation/media/",
    file_retention_days: 90,

    // Security
    session_timeout_minutes: 60,
    password_min_length: 8,
    login_attempt_limit: 5,
    two_factor_enabled: false,
    audit_log_retention_days: 365,
  });

  // User & Role State
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const userModal = useModal();
  const deleteUserModal = useModal();
  const passwordResetModal = useModal();
  const [userData, setUserData] = useState({ name: "", email: "", role: "operator", password: "" });
  const [resetPassword, setResetPassword] = useState("");
  const [seatUsage, setSeatUsage] = useState({ admins: 0, maxAdmins: 0, users: 0, maxUsers: 0 });

  // Profile State
  const [profile, setProfile] = useState({
    name: currentUser?.name || currentUser?.username || "Admin",
    email: currentUser?.email || "admin@example.com",
  });
  const [profileSaving, setProfileSaving] = useState(false);

  // Password State
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Email Change State
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailStep, setEmailStep] = useState(1); // 1 = form, 2 = otp
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [emailRequestId, setEmailRequestId] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailExpiresAt, setEmailExpiresAt] = useState(null);


  // 2FA State
  const [twoFAStatus, setTwoFAStatus] = useState({ enabled: false, backupCount: 0 });
  const [showSetup2FA, setShowSetup2FA] = useState(false);
  const [setup2FAData, setSetup2FAData] = useState(null); // { secret, qr_code, otpauth_uri }
  const [setup2FAStep, setSetup2FAStep] = useState(1); // 1=QR, 2=verify, 3=backup codes
  const [setup2FACode, setSetup2FACode] = useState("");
  const [setup2FABackupCodes, setSetup2FABackupCodes] = useState([]);
  const [setup2FALoading, setSetup2FALoading] = useState(false);
  const [showDisable2FA, setShowDisable2FA] = useState(false);
  const [disable2FAPassword, setDisable2FAPassword] = useState("");
  const [showRegenCodes, setShowRegenCodes] = useState(false);
  const [regenPassword, setRegenPassword] = useState("");
  const [regenCodes, setRegenCodes] = useState([]);
  const [twoFALoading, setTwoFALoading] = useState(false);

  useEffect(() => {
    // Fetch system settings
    settingsApi
      .getSettings()
      .then((res) => {
        if (res.data) setSettings((prev) => ({ ...prev, ...res.data }));
      })
      .catch((err) => {
        console.error("Failed to load settings from DB:", err);
      });

    // Fetch users list
    loadUsers();

    // Fetch profile (for 2FA status)
    settingsApi
      .getProfile()
      .then((res) => {
        if (res.data) {
          setProfile((prev) => ({ ...prev, name: res.data.name || prev.name, email: res.data.email || prev.email }));
          setTwoFAStatus({ enabled: res.data.two_factor_enabled || false, backupCount: res.data.two_factor_backup_count || 0 });
        }
      })
      .catch((err) => {
        console.error("Failed to load profile:", err);
      });
  }, []);

  const loadUsers = () => {
    setUsersLoading(true);
    usersApi
      .listUsers()
      .then((res) => {
        const data = res.data.results || res.data || [];
        setUsers(data);
        // Compute seat usage from user data
        const admins = data.filter((u) => u.role === "admin").length;
        const nonAdmins = data.filter((u) => !(["owner", "admin"].includes(u.role))).length;
        // Get limits from account API or settings - use first user's org info as proxy
        setSeatUsage((prev) => ({ ...prev, admins, users: nonAdmins }));
      })
      .catch(() => {
        setUsers([]);
      })
      .finally(() => setUsersLoading(false));

    // Fetch account info for seat limits
    import("../../../services/api").then(({ default: api }) => {
      api.get("/account/").then((res) => {
        if (res.data) {
          setSeatUsage((prev) => ({
            ...prev,
            maxAdmins: res.data.max_admins || 0,
            maxUsers: res.data.max_users || 0,
          }));
        }
      }).catch(() => { });
    });
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { app_name: _platformAppName, ...organizationSettings } = settings;
      const res = await settingsApi.updateSettings(organizationSettings);
      if (res.data) setSettings((prev) => ({ ...prev, ...res.data }));
      toast.success("System configuration settings updated successfully!");
    } catch (_e) {
      toast.error("Failed to save system settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!userData.email) {
      toast.warning("Email is required.");
      return;
    }

    try {
      const payload = { ...userData };
      if (!payload.password) delete payload.password;
      if (userModal.data?.id) {
        await usersApi.updateUser(userModal.data.id, payload);
        toast.success("User updated.");
      } else {
        await usersApi.createUser(payload);
        toast.success("User created.");
      }
      userModal.closeModal();
      loadUsers();
    } catch (err) {
      toast.error(apiError(err, "Failed to save user."));
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserModal.data?.id) return;
    try {
      await usersApi.deleteUser(deleteUserModal.data.id);
      toast.success("User deleted.");
      deleteUserModal.closeModal();
      loadUsers();
    } catch (_e) {
      toast.error(_e.response?.data?.detail || "Failed to delete user.");
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!passwordResetModal.data?.id || !resetPassword) return;
    try {
      await usersApi.setPassword(passwordResetModal.data.id, resetPassword);
      toast.success("Password updated and sessions revoked.");
      passwordResetModal.closeModal();
      setResetPassword("");
      loadUsers();
    } catch (err) {
      toast.error(apiError(err, "Failed to reset password."));
    }
  };

  const handleDeactivateUser = async (user) => {
    try {
      await usersApi.deactivateUser(user.id);
      toast.success(`${user.name || user.email} deactivated.`);
      loadUsers();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to deactivate user.");
    }
  };

  const handleReactivateUser = async (user) => {
    try {
      await usersApi.reactivateUser(user.id);
      toast.success(`${user.name || user.email} reactivated.`);
      loadUsers();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to reactivate user.");
    }
  };

  const handleRevokeUserSessions = async (user) => {
    try {
      const res = await usersApi.revokeSessions(user.id);
      toast.success(res.data.detail || "Sessions revoked.");
      loadUsers();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to revoke sessions.");
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      const res = await settingsApi.updateProfile({ name: profile.name });
      updateStoredUser({ ...currentUser, name: res.data.name || profile.name });
      toast.success("Profile details updated successfully!");
    } catch (err) {
      toast.error(apiError(err, "Failed to update profile."));
    } finally {
      setProfileSaving(false);
    }
  };

  const handleOpenEmailModal = () => {
    setShowEmailModal(true);
    setEmailStep(1);
    setNewEmail("");
    setEmailPassword("");
    setEmailOtp("");
    setEmailRequestId("");
    setEmailExpiresAt(null);
  };

  const handleRequestEmailChange = async (e) => {
    e.preventDefault();
    if (!newEmail || !emailPassword) {
      toast.warning("Please enter your new email and current password.");
      return;
    }
    setEmailLoading(true);
    try {
      const res = await settingsApi.requestEmailChange({
        new_email: newEmail,
        current_password: emailPassword,
      });
      setEmailRequestId(res.data.request_id);
      setEmailExpiresAt(res.data.expires_at);
      setEmailStep(2);
      toast.success(res.data.detail || "Verification code sent to your new email!");
    } catch (err) {
      toast.error(apiError(err, "Failed to request email change."));
    } finally {
      setEmailLoading(false);
    }
  };

  const handleConfirmEmailChange = async (e) => {
    e.preventDefault();
    if (!emailOtp || emailOtp.trim().length !== 6) {
      toast.warning("Please enter the 6-digit verification code.");
      return;
    }
    setEmailLoading(true);
    try {
      const res = await settingsApi.confirmEmailChange({
        request_id: emailRequestId,
        code: emailOtp.trim(),
      });
      setProfile((prev) => ({ ...prev, email: res.data.profile?.email || newEmail }));
      updateStoredUser({
        ...currentUser,
        email: res.data.profile?.email || newEmail,
        username: res.data.profile?.username || currentUser.username,
      });
      toast.success(res.data.detail || "Email updated successfully!");
      setShowEmailModal(false);
      setEmailStep(1);
      setNewEmail("");
      setEmailPassword("");
      setEmailOtp("");
    } catch (err) {
      toast.error(apiError(err, "Verification failed."));
    } finally {
      setEmailLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!passwordForm.current_password || !passwordForm.new_password) {
      toast.warning("Please fill in all password fields.");
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error("New password and confirmation do not match.");
      return;
    }
    if (passwordForm.new_password.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }

    setPasswordSaving(true);
    try {
      await settingsApi.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
      toast.success("Password changed successfully! Signing out to verify new password...");
      setTimeout(() => {
        clearTokens();
        navigate("/login", { replace: true });
      }, 1200);
    } catch (err) {
      toast.error(apiError(err, "Failed to change password."));
    } finally {
      setPasswordSaving(false);
    }
  };


  // ── 2FA Handlers ──────────────────────────────────────────────────

  const handleStart2FASetup = async () => {
    setSetup2FALoading(true);
    try {
      const res = await twoFactorApi.setup();
      setSetup2FAData(res.data);
      setSetup2FAStep(1);
      setSetup2FACode("");
      setSetup2FABackupCodes([]);
      setShowSetup2FA(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to start 2FA setup.");
    } finally {
      setSetup2FALoading(false);
    }
  };

  const handleConfirm2FA = async () => {
    if (!setup2FACode || setup2FACode.length !== 6) {
      toast.warning("Please enter the 6-digit code from your authenticator app.");
      return;
    }
    setSetup2FALoading(true);
    try {
      const res = await twoFactorApi.confirm({ secret: setup2FAData.secret, code: setup2FACode });
      setSetup2FABackupCodes(res.data.backup_codes || []);
      setSetup2FAStep(3);
      setTwoFAStatus({ enabled: true, backupCount: (res.data.backup_codes || []).length });
      toast.success("Two-factor authentication enabled!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Invalid code. Please try again.");
    } finally {
      setSetup2FALoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!disable2FAPassword) {
      toast.warning("Enter your current password to confirm.");
      return;
    }
    setTwoFALoading(true);
    try {
      await twoFactorApi.disable({ password: disable2FAPassword });
      setTwoFAStatus({ enabled: false, backupCount: 0 });
      setShowDisable2FA(false);
      setDisable2FAPassword("");
      toast.success("Two-factor authentication disabled.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to disable 2FA.");
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleRegenBackupCodes = async () => {
    if (!regenPassword) {
      toast.warning("Enter your current password to confirm.");
      return;
    }
    setTwoFALoading(true);
    try {
      const res = await twoFactorApi.regenerateBackupCodes({ password: regenPassword });
      setRegenCodes(res.data.backup_codes || []);
      setTwoFAStatus((prev) => ({ ...prev, backupCount: (res.data.backup_codes || []).length }));
      toast.success("Backup codes regenerated.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to regenerate codes.");
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleResetUser2FA = async (user) => {
    if (
      !window.confirm(
        `Are you sure you want to reset 2FA for ${user.name || user.email}? Their authenticator secret and backup codes will be cleared, allowing them to sign in or re-enroll.`
      )
    ) {
      return;
    }
    try {
      await usersApi.resetUser2FA(user.id);
      toast.success(`2FA has been reset for ${user.name || user.email}.`);
      loadUsers();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to reset 2FA.");
    }
  };

  const copyBackupCodes = (codes) => {
    navigator.clipboard.writeText(codes.join("\n"));
    toast.success("Backup codes copied to clipboard.");
  };

  const downloadBackupCodes = (codes) => {
    const text = `Mail Flow - Two-Factor Backup Recovery Codes\n${"-".repeat(48)}\n\n${codes.join("\n")}\n\nKeep these codes safe. Each code can only be used once.\nGenerated: ${new Date().toLocaleString()}`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mailflow-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const userColumns = [
    { key: "name", header: "Name", render: (val) => <span className="font-semibold text-slate-100">{val}</span> },
    { key: "email", header: "Email", render: (val) => <span className="font-mono text-slate-300">{val}</span> },
    {
      key: "role",
      header: "Role",
      render: (val) => {
        const styles = {
          admin: "bg-rose-500/10 text-rose-400 border-rose-500/30",
          manager: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
          operator: "bg-sky-500/10 text-sky-400 border-sky-500/30",
          viewer: "bg-slate-500/10 text-slate-400 border-slate-500/30",
        };
        return (
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[val] || styles.viewer}`}>
            {val}
          </span>
        );
      },
    },
    {
      key: "is_active",
      header: "Status",
      render: (val) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${val ? "bg-emerald-400/10 text-emerald-300 border border-emerald-500/30" : "bg-slate-500/10 text-slate-400 border border-slate-600/30"}`}>
          {val ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "two_factor_enabled",
      header: "2FA",
      render: (val) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${val
          ? "bg-emerald-400/10 text-emerald-300 border border-emerald-500/30"
          : "bg-slate-500/10 text-slate-500 border border-slate-600/30"
          }`}>
          {val ? "Active" : "Off"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => {
              setUserData({ name: row.name || "", email: row.email, role: row.role, password: "" });
              userModal.openModal(row);
            }}
            className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
            title="Edit user"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          {row.can_reset_password && (
            <button
              onClick={() => {
                setResetPassword("");
                passwordResetModal.openModal(row);
              }}
              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
              title="Reset password"
            >
              <Key className="w-4 h-4" />
            </button>
          )}
          {row.is_active && row.can_deactivate && (
            <button
              onClick={() => handleDeactivateUser(row)}
              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
              title="Deactivate"
            >
              <UserX className="w-4 h-4" />
            </button>
          )}
          {!row.is_active && (
            <button
              onClick={() => handleReactivateUser(row)}
              className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
              title="Reactivate"
            >
              <UserCheck className="w-4 h-4" />
            </button>
          )}
          {(row.active_session_count || 0) > 0 && (
            <button
              onClick={() => handleRevokeUserSessions(row)}
              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
              title="Revoke sessions"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
          {row.can_delete && (
            <button
              onClick={() => deleteUserModal.openModal(row)}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
              title="Delete user"
            >
              <Trash className="w-4 h-4" />
            </button>
          )}
          {row.can_reset_2fa && (
            <button
              onClick={() => handleResetUser2FA(row)}
              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
              title="Reset 2FA"
            >
              <ShieldOff className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];


  return {
    toast,
    activeTab,
    setActiveTab,
    saving,
    settings,
    setSettings,
    users,
    usersLoading,
    userModal,
    deleteUserModal,
    passwordResetModal,
    userData,
    setUserData,
    resetPassword,
    setResetPassword,
    seatUsage,
    profile,
    setProfile,
    profileSaving,
    handleSaveProfile,
    passwordForm,
    setPasswordForm,
    passwordSaving,
    handleUpdatePassword,
    showEmailModal,
    setShowEmailModal,
    emailStep,
    setEmailStep,
    newEmail,
    setNewEmail,
    emailPassword,
    setEmailPassword,
    emailOtp,
    setEmailOtp,
    emailLoading,
    handleOpenEmailModal,
    handleRequestEmailChange,
    handleConfirmEmailChange,
    twoFAStatus,
    showSetup2FA,
    setShowSetup2FA,
    setup2FAData,
    setup2FAStep,
    setSetup2FAStep,
    setup2FACode,
    setSetup2FACode,
    setup2FABackupCodes,
    setup2FALoading,
    showDisable2FA,
    setShowDisable2FA,
    disable2FAPassword,
    setDisable2FAPassword,
    showRegenCodes,
    setShowRegenCodes,
    regenPassword,
    setRegenPassword,
    regenCodes,
    setRegenCodes,
    twoFALoading,
    handleSaveSettings,
    handleSaveUser,
    handleDeleteUser,
    handleResetPassword,
    handleStart2FASetup,
    handleConfirm2FA,
    handleDisable2FA,
    handleRegenBackupCodes,
    copyBackupCodes,
    downloadBackupCodes,
    userColumns,
  };
}


