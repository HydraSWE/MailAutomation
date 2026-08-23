import React from "react";
import {
  AlertCircle,
  Copy,
  Eye,
  Loader2,
  Megaphone,
  RefreshCw,
  Send,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import BrandLogo from "../../../components/BrandLogo";
import {
  ORGANIZATION_STATUS_OPTIONS,
  ROLE_OPTIONS,
  TEMPLATE_VARIABLES,
} from "./constants";

export default function BroadcastComposerStudio({
  studioOpen,
  setStudioOpen,
  studioTab,
  setStudioTab,
  studioError,
  setStudioError,
  form,
  setForm,
  plans,
  previewCount,
  previewing,
  saving,
  checkAudiencePreview,
  applyPreset,
  insertVariable,
  saveDraft,
  setConfirmAction,
}) {
  if (!studioOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-5xl my-8 rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Studio Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Broadcast Composer Studio</h2>
              <p className="text-xs text-slate-400">
                Draft, target, and preview platform-wide email announcements.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Tabs */}
            <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setStudioTab("compose")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  studioTab === "compose" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Compose & Audience
              </button>
              <button
                type="button"
                onClick={() => setStudioTab("preview")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  studioTab === "preview" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> Live Email Preview
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setStudioOpen(false);
                setStudioError("");
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* In-Modal Alert Banner */}
        {studioError && (
          <div className="mx-6 mt-4 p-3.5 border border-rose-500/30 bg-rose-500/10 rounded-xl text-xs font-medium text-rose-300 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{studioError}</span>
            </div>
            <button type="button" onClick={() => setStudioError("")} className="text-rose-400 hover:text-rose-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Studio Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {studioTab === "compose" ? (
            <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6">
              {/* Left Column: Message Content */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-300">Subject Line</label>
                    <span className="text-[11px] text-slate-500">{form.subject.length}/150 characters</span>
                  </div>
                  <input
                    required
                    type="text"
                    placeholder="e.g., Scheduled Maintenance Notification: Sunday 02:00 UTC"
                    value={form.subject}
                    onChange={(e) => {
                      setForm({ ...form, subject: e.target.value });
                    }}
                    className="mt-1.5 w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-300">Message Content</label>
                    <div className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-indigo-400" />
                      <span className="text-[11px] text-indigo-400 font-medium">Variables supported</span>
                    </div>
                  </div>

                  {/* Variable Quick-Insert Bar */}
                  <div className="mt-1.5 flex flex-wrap gap-1.5 p-2 rounded-xl bg-slate-950/50 border border-slate-800/80">
                    <span className="text-[11px] text-slate-500 self-center mr-1">Insert tag:</span>
                    {TEMPLATE_VARIABLES.map((v) => (
                      <button
                        key={v.tag}
                        type="button"
                        onClick={() => insertVariable(v.tag)}
                        className="px-2 py-0.5 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-300 text-[11px] font-mono transition-colors"
                      >
                        + {v.tag}
                      </button>
                    ))}
                  </div>

                  <textarea
                    required
                    rows={10}
                    placeholder="Write your broadcast announcement here...&#10;&#10;Dear {{user_name}},&#10;&#10;We are writing to notify you regarding an upcoming update for {{organization_name}}..."
                    value={form.body}
                    onChange={(e) => {
                      setForm({ ...form, body: e.target.value });
                    }}
                    className="mt-2 w-full p-3.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-y font-mono leading-relaxed"
                  />
                </div>
              </div>

              {/* Right Column: Audience Target Builder */}
              <div className="space-y-4">
                {/* Quick Presets Strip */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">Audience Presets</span>
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => applyPreset("all_users")}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:border-indigo-500 hover:text-white text-[11px] font-medium transition-all text-left"
                    >
                      ⚡ All Users
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset("admins_only")}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:border-indigo-500 hover:text-white text-[11px] font-medium transition-all text-left"
                    >
                      👑 Owners & Admins
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset("paid_plans")}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:border-indigo-500 hover:text-white text-[11px] font-medium transition-all text-left"
                    >
                      💎 Paid Plans
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset("active_orgs")}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:border-indigo-500 hover:text-white text-[11px] font-medium transition-all text-left"
                    >
                      🟢 Active Tenants
                    </button>
                  </div>
                </div>

                {/* Roles Selector */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 space-y-2">
                  <span className="text-xs font-semibold text-slate-300">Target Roles</span>
                  <div className="flex flex-wrap gap-1.5">
                    {ROLE_OPTIONS.map((r) => {
                      const isSelected = form.target_roles.includes(r.value);
                      return (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => {
                            const next = isSelected
                              ? form.target_roles.filter((x) => x !== r.value)
                              : [...form.target_roles, r.value];
                            const updated = { ...form, target_roles: next };
                            setForm(updated);
                            checkAudiencePreview(updated);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                            isSelected
                              ? "bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm"
                              : "bg-slate-900 border-slate-700/80 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Subscription Plans Selector */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 space-y-2">
                  <span className="text-xs font-semibold text-slate-300">Target Subscription Plans</span>
                  <div className="flex flex-wrap gap-1.5">
                    {plans.map((p) => {
                      const isSelected = form.target_plan_slugs.includes(p.slug);
                      return (
                        <button
                          key={p.slug}
                          type="button"
                          onClick={() => {
                            const next = isSelected
                              ? form.target_plan_slugs.filter((x) => x !== p.slug)
                              : [...form.target_plan_slugs, p.slug];
                            const updated = { ...form, target_plan_slugs: next };
                            setForm(updated);
                            checkAudiencePreview(updated);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                            isSelected
                              ? "bg-cyan-600/20 border-cyan-500 text-cyan-300 shadow-sm"
                              : "bg-slate-900 border-slate-700/80 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Org Status & Active Only */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 space-y-3">
                  <div>
                    <span className="text-xs font-semibold text-slate-300">Tenant Status</span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {ORGANIZATION_STATUS_OPTIONS.map((s) => {
                        const isSelected = form.target_organization_statuses.includes(s.value);
                        return (
                          <button
                            key={s.value}
                            type="button"
                            onClick={() => {
                              const next = isSelected
                                ? form.target_organization_statuses.filter((x) => x !== s.value)
                                : [...form.target_organization_statuses, s.value];
                              const updated = { ...form, target_organization_statuses: next };
                              setForm(updated);
                              checkAudiencePreview(updated);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                              isSelected
                                ? "bg-amber-600/20 border-amber-500 text-amber-300 shadow-sm"
                                : "bg-slate-900 border-slate-700/80 text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer pt-1 border-t border-slate-800/80">
                    <input
                      type="checkbox"
                      checked={form.active_only}
                      onChange={(e) => {
                        const updated = { ...form, active_only: e.target.checked };
                        setForm(updated);
                        checkAudiencePreview(updated);
                      }}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Require active user status (exclude inactive/unverified)</span>
                  </label>
                </div>

                {/* Real-time Audience Calculator Widget */}
                <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-slate-400">Target Reach Estimate</span>
                    <div className="text-lg font-bold text-slate-100 mt-0.5">
                      {previewCount !== null ? (
                        <span className="text-emerald-400">{previewCount} matching users</span>
                      ) : (
                        <span className="text-slate-400">Pending calculation</span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={previewing}
                    onClick={() => checkAudiencePreview(form)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-semibold transition-all disabled:opacity-50"
                  >
                    {previewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Check Audience
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Live Email Inbox Mockup Preview */
            <div className="max-w-2xl mx-auto rounded-2xl border border-slate-700/80 bg-slate-950 shadow-2xl overflow-hidden">
              {/* Email Client Header Bar */}
              <div className="p-4 bg-slate-900 border-b border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-300">From:</span>
                    <span>Mail Flow &lt;MailFlow@annomous.com&gt;</span>
                  </div>
                  <span className="text-[11px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full font-medium">
                    Sample Recipient Preview
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">To:</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                    Targeted Users ({previewCount !== null ? previewCount : "Target Scope"})
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-xs text-slate-500">Subject:</span>
                  <h3 className="text-base font-bold text-slate-100 mt-0.5">
                    {interpolatePreview(form.subject) || "Official Platform Broadcast Announcement"}
                  </h3>
                </div>
              </div>

              {/* Rendered Email Body */}
              <div className="p-8 bg-slate-900/40 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <BrandLogo className="h-7 w-auto" />
                  <span className="text-[11px] uppercase tracking-wider text-indigo-400 font-semibold px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                    System Notice
                  </span>
                </div>

                <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                  {interpolatePreview(form.body) || "This is a preview of the broadcast announcement message body."}
                </div>

                <div className="pt-6 border-t border-slate-800 text-center space-y-2">
                  <p className="text-[11px] text-slate-500">
                    You are receiving this official service announcement as a registered member of the Mail Flow platform.
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Mail Flow Cloud Infrastructure - Automated Dispatcher
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Studio Footer Bar */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-0 z-10">
          <div className="text-xs text-slate-400">
            {previewCount !== null ? (
              <span>Ready to dispatch to <strong className="text-slate-200">{previewCount}</strong> recipient(s).</span>
            ) : (
              <span>Please check audience reach before dispatching.</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => {
                setStudioOpen(false);
                setStudioError("");
              }}
              className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              disabled={saving || !form.subject.trim() || !form.body.trim()}
              onClick={saveDraft}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-xs font-semibold text-indigo-300 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
              Save as Draft
            </button>
            <button
              type="button"
              disabled={saving || !form.subject.trim() || !form.body.trim()}
              onClick={async () => {
                let count = previewCount;
                if (count === null) {
                  count = await checkAudiencePreview(form);
                }
                if (count === null || count <= 0) {
                  setStudioError("No matching users found for this audience target.");
                  return;
                }
                setConfirmAction({
                  type: "create_and_launch",
                  formPayload: form,
                  title: "Launch Platform Broadcast",
                  message: `Create and dispatch "${form.subject}" immediately to ${count} matching user(s)?`,
                  confirmLabel: "Launch Broadcast Now",
                  isDanger: false,
                });
              }}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-semibold shadow-md shadow-indigo-600/25 transition-all active:scale-95 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" /> Launch Immediately
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function interpolatePreview(text) {
  if (!text) return "";
  const sampleContext = {
    user_name: "Sarah Jenkins",
    name: "Sarah Jenkins",
    first_name: "Sarah",
    username: "sjenkins",
    email: "admin@acme-corp.com",
    user_email: "admin@acme-corp.com",
    organization_name: "Acme Corporation",
    org_name: "Acme Corporation",
    company: "Acme Corporation",
    organization: "Acme Corporation",
    plan_name: "Enterprise Pro",
    plan: "Enterprise Pro",
    support_email: "support@annomous.com",
    role: "Administrator",
  };
  return text.replace(/\{\{?\s*([a-zA-Z0-9_]+)\s*\}?\}/g, (match, tag) => {
    const key = tag.trim().toLowerCase();
    return sampleContext[key] !== undefined ? sampleContext[key] : match;
  });
}
