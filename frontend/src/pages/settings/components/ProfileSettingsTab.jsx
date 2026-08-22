import { Loader2, RefreshCcw, Save, ShieldCheck, ShieldOff } from "lucide-react";

export default function ProfileSettingsTab({ profile, setProfile, onSaveProfile, twoFAStatus, onStart2FASetup, setup2FALoading, setShowRegenCodes, setRegenPassword, setRegenCodes, setShowDisable2FA, setDisable2FAPassword }) {
  return (
        <div className="space-y-6">
          {/* Profile Form */}
          <form onSubmit={onSaveProfile} className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-100">User Account Profile</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Your Name</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3.5 py-2 text-sm text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Your Email</label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3.5 py-2 text-sm text-slate-100"
                />
              </div>
            </div>

            <div className="space-y-4 pt-2 border-t border-slate-800">
              <h4 className="text-sm font-bold text-slate-200">Change Password</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Current Password</label>
                  <input
                    type="password"
                    value={profile.current_password}
                    onChange={(e) => setProfile({ ...profile, current_password: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3.5 py-2 text-sm text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">New Password</label>
                  <input
                    type="password"
                    value={profile.new_password}
                    onChange={(e) => setProfile({ ...profile, new_password: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3.5 py-2 text-sm text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={profile.confirm_password}
                    onChange={(e) => setProfile({ ...profile, confirm_password: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3.5 py-2 text-sm text-slate-100"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/25"
              >
                <Save className="w-4 h-4" />
                Update Profile
              </button>
            </div>
          </form>

          {/* Two-Factor Authentication Card */}
          <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${twoFAStatus.enabled ? "bg-emerald-500/10" : "bg-slate-800"}`}>
                  <ShieldCheck className={`w-5 h-5 ${twoFAStatus.enabled ? "text-emerald-400" : "text-slate-500"}`} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100">Two-Factor Authentication</h4>
                  <p className="text-xs text-slate-400">
                    {twoFAStatus.enabled
                      ? `Active (${twoFAStatus.backupCount} backup codes remaining)`
                      : "Add an extra layer of security to your account"}
                  </p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${twoFAStatus.enabled
                ? "bg-emerald-400/10 text-emerald-300 border-emerald-500/30"
                : "bg-slate-700/30 text-slate-400 border-slate-600/30"
                }`}>
                {twoFAStatus.enabled ? "Enabled" : "Disabled"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800">
              {!twoFAStatus.enabled ? (
                <button
                  onClick={onStart2FASetup}
                  disabled={setup2FALoading}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-60"
                >
                  {setup2FALoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  Enable 2FA
                </button>
              ) : (
                <>
                  <button
                    onClick={() => { setShowRegenCodes(true); setRegenPassword(""); setRegenCodes([]); }}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" />
                    Regenerate Backup Codes
                  </button>
                  <button
                    onClick={() => { setShowDisable2FA(true); setDisable2FAPassword(""); }}
                    className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-semibold transition-all"
                  >
                    <ShieldOff className="w-3.5 h-3.5" />
                    Disable 2FA
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
  );
}

