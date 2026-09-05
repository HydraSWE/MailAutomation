import React, { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  RefreshCcw,
  Save,
  ShieldCheck,
  ShieldOff,
  User,
  X,
} from "lucide-react";

export default function ProfileSettingsTab({
  profile,
  setProfile,
  profileSaving,
  onSaveProfile,
  passwordForm,
  setPasswordForm,
  passwordSaving,
  onUpdatePassword,
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
  onOpenEmailModal,
  onRequestEmailChange,
  onConfirmEmailChange,
  twoFAStatus,
  onStart2FASetup,
  setup2FALoading,
  setShowRegenCodes,
  setRegenPassword,
  setRegenCodes,
  setShowDisable2FA,
  setDisable2FAPassword,
}) {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showModalPassword, setShowModalPassword] = useState(false);

  return (
    <div className="space-y-6">
      {/* 1. Account Profile Card */}
      <form
        onSubmit={onSaveProfile}
        className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-5 shadow-xl backdrop-blur-sm"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-400" />
              Personal Profile
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Update your display name visible across your team workspace.
            </p>
          </div>
          <button
            type="submit"
            disabled={profileSaving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/25 transition-all"
          >
            {profileSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Save Details
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Display Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={profile?.name || ""}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                placeholder="Enter your name"
                className="w-full bg-slate-900/90 border border-slate-700/70 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>
        </div>
      </form>

      {/* 2. Account Email Address Card */}
      <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Mail className="w-4 h-4 text-sky-400" />
              Account Email
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Your primary email is used for account authentication and security communications.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenEmailModal}
            className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <Mail className="w-3.5 h-3.5 text-sky-400" />
            Change Email Address
          </button>
        </div>

        <div className="flex items-center gap-3 p-3.5 bg-slate-950/40 border border-slate-800/80 rounded-xl">
          <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
            <Mail className="w-4 h-4 text-sky-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-200 truncate">
                {profile?.email || "No email assigned"}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-2.5 h-2.5" />
                Verified
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Updating your email requires verifying ownership with a 6-digit one-time code.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Password & Security Card */}
      <form
        onSubmit={onUpdatePassword}
        className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-5 shadow-xl backdrop-blur-sm"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" />
              Password & Authentication
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Update your account password. Modifying password will sign out other active sessions.
            </p>
          </div>
          <button
            type="submit"
            disabled={passwordSaving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/25 transition-all"
          >
            {passwordSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <KeyRound className="w-3.5 h-3.5" />
            )}
            Update Password
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {/* Current Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? "text" : "password"}
                required
                value={passwordForm?.current_password || ""}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, current_password: e.target.value })
                }
                placeholder="••••••••"
                className="w-full bg-slate-900/90 border border-slate-700/70 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                tabIndex={-1}
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                required
                minLength={8}
                value={passwordForm?.new_password || ""}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, new_password: e.target.value })
                }
                placeholder="••••••••"
                className="w-full bg-slate-900/90 border border-slate-700/70 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                tabIndex={-1}
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Minimum 8 characters</span>
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                minLength={8}
                value={passwordForm?.confirm_password || ""}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, confirm_password: e.target.value })
                }
                placeholder="••••••••"
                className="w-full bg-slate-900/90 border border-slate-700/70 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {passwordForm?.confirm_password && (
              <span
                className={`text-[10px] mt-1 block font-medium ${
                  passwordForm.new_password === passwordForm.confirm_password
                    ? "text-emerald-400"
                    : "text-rose-400"
                }`}
              >
                {passwordForm.new_password === passwordForm.confirm_password
                  ? "✓ Passwords match"
                  : "✗ Passwords do not match"}
              </span>
            )}
          </div>
        </div>
      </form>

      {/* 4. Two-Factor Authentication Card */}
      <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl shadow-xl space-y-4 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                twoFAStatus?.enabled ? "bg-emerald-500/10" : "bg-slate-800"
              }`}
            >
              <ShieldCheck
                className={`w-5 h-5 ${
                  twoFAStatus?.enabled ? "text-emerald-400" : "text-slate-500"
                }`}
              />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-100">Two-Factor Authentication (2FA)</h4>
              <p className="text-xs text-slate-400">
                {twoFAStatus?.enabled
                  ? `Active (${twoFAStatus.backupCount} backup codes remaining)`
                  : "Add an extra layer of security using an authenticator app (TOTP)."}
              </p>
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${
              twoFAStatus?.enabled
                ? "bg-emerald-400/10 text-emerald-300 border-emerald-500/30"
                : "bg-slate-700/30 text-slate-400 border-slate-600/30"
            }`}
          >
            {twoFAStatus?.enabled ? "Enabled" : "Disabled"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800">
          {!twoFAStatus?.enabled ? (
            <button
              onClick={onStart2FASetup}
              disabled={setup2FALoading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-60"
            >
              {setup2FALoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5" />
              )}
              Enable 2FA
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setShowRegenCodes(true);
                  setRegenPassword("");
                  setRegenCodes([]);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all border border-slate-700/60"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                Regenerate Backup Codes
              </button>
              <button
                onClick={() => {
                  setShowDisable2FA(true);
                  setDisable2FAPassword("");
                }}
                className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-semibold transition-all"
              >
                <ShieldOff className="w-3.5 h-3.5" />
                Disable 2FA
              </button>
            </>
          )}
        </div>
      </div>

      {/* 5. Email Change Modal (OTP Verification Flow) */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-sky-400" />
                </div>
                <h3 className="text-base font-bold text-slate-100">
                  {emailStep === 1 ? "Change Account Email" : "Verify New Email"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {emailStep === 1 ? (
              <form onSubmit={onRequestEmailChange} className="space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Enter your new email address and your current password to receive a 6-digit
                  verification code.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    New Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showModalPassword ? "text" : "password"}
                      required
                      value={emailPassword}
                      onChange={(e) => setEmailPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowModalPassword(!showModalPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                    >
                      {showModalPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowEmailModal(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={emailLoading || !newEmail || !emailPassword}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/25 transition-all"
                  >
                    {emailLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Send Verification Code
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={onConfirmEmailChange} className="space-y-4">
                <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-sky-200">
                    We sent a 6-digit verification code to <span className="font-bold text-white">{newEmail}</span>. The code will expire in 10 minutes.
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 text-center">
                    Enter 6-Digit Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    autoFocus
                    value={emailOtp}
                    onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    className="w-full text-center tracking-[0.4em] font-mono text-2xl bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => setEmailStep(1)}
                    className="text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    ← Edit email address
                  </button>
                  <button
                    type="button"
                    onClick={onRequestEmailChange}
                    disabled={emailLoading}
                    className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                  >
                    Resend code
                  </button>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowEmailModal(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={emailLoading || emailOtp.length !== 6}
                    className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/25 transition-all"
                  >
                    {emailLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Verify & Update Email
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


