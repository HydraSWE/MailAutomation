import { Save } from "lucide-react";

export default function EmailSettingsTab({ settings, setSettings, onSave, saving }) {
  return (
        <form onSubmit={onSave} className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-6 shadow-xl">
          <h3 className="text-lg font-bold text-slate-100">Email Queue & Tracking Defaults</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Default Retry Count</label>
              <input
                type="number"
                value={settings.retry_count}
                onChange={(e) => setSettings({ ...settings, retry_count: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3.5 py-2 text-sm text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Retry Delay (Seconds)</label>
              <input
                type="number"
                value={settings.retry_delay_seconds}
                onChange={(e) => setSettings({ ...settings, retry_delay_seconds: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3.5 py-2 text-sm text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Batch Size</label>
              <input
                type="number"
                value={settings.batch_size}
                onChange={(e) => setSettings({ ...settings, batch_size: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3.5 py-2 text-sm text-slate-100"
              />
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Tracking & Fallback Options</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.click_tracking}
                  onChange={(e) => setSettings({ ...settings, click_tracking: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded bg-slate-800 border-slate-700"
                />
                <span className="text-xs font-medium text-slate-200">Enable Click Tracking</span>
              </label>

              <label className="flex items-center gap-3 p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.plaintext_fallback}
                  onChange={(e) => setSettings({ ...settings, plaintext_fallback: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded bg-slate-800 border-slate-700"
                />
                <span className="text-xs font-medium text-slate-200">Plain-text Fallback</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Default Unsubscribe Footer</label>
            <textarea
              rows={3}
              value={settings.unsubscribe_footer}
              onChange={(e) => setSettings({ ...settings, unsubscribe_footer: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3.5 py-2 text-sm text-slate-100"
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/25"
            >
              <Save className="w-4 h-4" />
              Save Email Settings
            </button>
          </div>
        </form>
  );
}

