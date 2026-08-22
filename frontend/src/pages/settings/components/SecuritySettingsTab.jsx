import { Save, ShieldCheck } from "lucide-react";

export default function SecuritySettingsTab({ settings, setSettings, onSave, saving }) {
  return (
        <form onSubmit={onSave} className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-6 shadow-xl">
          <h3 className="text-lg font-bold text-slate-100">Security & Authentication Policy</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Session Timeout (Minutes)</label>
              <input
                type="number"
                value={settings.session_timeout_minutes}
                onChange={(e) => setSettings({ ...settings, session_timeout_minutes: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3.5 py-2 text-sm text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Minimum Password Length</label>
              <input
                type="number"
                value={settings.password_min_length}
                onChange={(e) => setSettings({ ...settings, password_min_length: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3.5 py-2 text-sm text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Login Attempt Limit</label>
              <input
                type="number"
                value={settings.login_attempt_limit}
                onChange={(e) => setSettings({ ...settings, login_attempt_limit: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3.5 py-2 text-sm text-slate-100"
              />
            </div>
          </div>

          {/* Organization-wide 2FA Enforcement Policy */}
          <div className="p-5 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className={`w-5 h-5 ${settings.two_factor_enabled ? "text-indigo-400" : "text-slate-500"}`} />
                <p className="text-sm font-bold text-slate-100">Enforce Organization 2FA Policy</p>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Require TOTP authenticator app verification for all members upon sign in. When disabled, 2FA is optional per user.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-all ${settings.two_factor_enabled
                ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-sm shadow-indigo-500/15"
                : "bg-slate-900 text-slate-500 border-slate-800"
                }`}>
                {settings.two_factor_enabled ? "Enforced" : "Disabled"}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={settings.two_factor_enabled}
                onClick={() => setSettings({ ...settings, two_factor_enabled: !settings.two_factor_enabled })}
                className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-950 ${settings.two_factor_enabled
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-500 border-indigo-400 shadow-lg shadow-indigo-600/40"
                  : "bg-slate-800 border-slate-700 hover:border-slate-600"
                  }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out mt-0.5 ${settings.two_factor_enabled ? "translate-x-7" : "translate-x-1"
                    }`}
                />
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/25"
            >
              <Save className="w-4 h-4" />
              Save Security Policy
            </button>
          </div>
        </form>
  );
}

