import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  FileSpreadsheet,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Server,
  Users,
  Mail,
  Send,
  Sparkles,
} from "lucide-react";
import { apiClient } from "../services/apiClient";
import { getUser, isAuthenticated } from "../utils/auth";
import BrandLogo from "../components/BrandLogo";
import CustomSelect from "../components/common/CustomSelect";

// ==========================================
// CONSTANTS & UTILITIES
// ==========================================
const base = "/billing/appsumo/";
const ownerUrl = "/billing/platform/appsumo/";
const codePlaceholder = "AS-7K9M-2N4P-Q8RT-W3XY-6AB7-CDEF-GHJK-LMNP";

const fmt = (n) => Number(n || 0).toLocaleString();
const date = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    : "Not redeemed";

function errorText(error) {
  const data = error.response?.data;
  if (typeof data === "string") {
    if (data.toLowerCase().includes("<!doctype") || data.toLowerCase().includes("<html")) {
      return "Server error. Check the backend logs and confirm the AppSumo migrations are applied.";
    }
    return data || "The request could not be completed.";
  }
  return String(
    data?.detail ||
    Object.values(data || {})
      .flat()
      .join(" ") ||
    "The request could not be completed."
  );
}

// ==========================================
// UI ATOMS & PRIMITIVES
// ==========================================
function Notice({ children, error = false }) {
  if (!children) return null;
  return (
    <div
      role={error ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-xl border p-4 text-sm transition-all ${error
          ? "border-rose-500/30 bg-rose-950/40 text-rose-200"
          : "border-cyan-500/30 bg-cyan-950/30 text-cyan-200"
        }`}
    >
      {error ? (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
      ) : (
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
      )}
      <div className="flex-1 leading-relaxed">{children}</div>
    </div>
  );
}

function Field({ label, hint, ...props }) {
  return (
    <label className="block space-y-1.5 text-sm font-medium text-slate-300">
      <span>{label}</span>
      <input
        className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 shadow-inner transition-colors focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      />
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

// ==========================================
// TIER REFERENCE TABLE
// ==========================================
function TierReference({ tiers }) {
  if (!tiers?.length) return null;

  return (
    <section className="rounded-2xl border border-slate-800/80 bg-slate-900/30 p-6 backdrop-blur-sm">
      <div className="flex flex-col gap-1 border-b border-slate-800/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">AppSumo Tier Reference</h2>
          <p className="text-xs text-slate-400">
            Redeem one code for Tier 1. Add additional codes to unlock higher capacity up to Tier 5.
          </p>
        </div>
        <span className="self-start rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-300">
          Lifetime License
        </span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="py-3 pr-4 font-medium uppercase tracking-wider">Tier</th>
              <th className="py-3 pr-4 font-medium uppercase tracking-wider">Codes</th>
              <th className="py-3 pr-4 font-medium uppercase tracking-wider">Sends / 30d</th>
              <th className="py-3 pr-4 font-medium uppercase tracking-wider">Contacts</th>
              <th className="py-3 pr-4 font-medium uppercase tracking-wider">Mailboxes</th>
              <th className="py-3 pr-4 font-medium uppercase tracking-wider">Seats</th>
              <th className="py-3 pr-4 font-medium uppercase tracking-wider">Lead Hunter / 30d</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {tiers.map((t) => (
              <tr key={t.tier} className="transition-colors hover:bg-slate-800/20">
                <td className="py-3.5 pr-4 font-semibold text-cyan-300">Tier {t.tier}</td>
                <td className="py-3.5 pr-4 text-slate-300">{t.tier}</td>
                <td className="py-3.5 pr-4 text-slate-300">{fmt(t.limits.emails)}</td>
                <td className="py-3.5 pr-4 text-slate-300">{fmt(t.limits.contacts)}</td>
                <td className="py-3.5 pr-4 text-slate-300">{t.limits.mailboxes}</td>
                <td className="py-3.5 pr-4 text-slate-300">{t.limits.seats}</td>
                <td className="py-3.5 pr-4 text-slate-300">{fmt(t.limits.imports)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-5 border-t border-slate-800/60 pt-4 text-xs leading-relaxed text-slate-400">
        All tiers include one workspace, Mail Workspace, two Lead Hunter devices per active seat, 10 campaign launches per day, and 250 contacts per push. Usage resets every 30 days without rollover. External mailbox, domain, and sending-provider costs are not included.
      </p>
    </section>
  );
}

// ==========================================
// CLOUDFLARE TURNSTILE VERIFICATION
// ==========================================
function Verification({ onToken }) {
  const ref = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const key = import.meta.env.VITE_TURNSTILE_SITE_KEY;
    if (!key) return;
    let widget;
    let cancelled = false;

    function render() {
      if (cancelled || !window.turnstile || !ref.current) return;
      widget = window.turnstile.render(ref.current, {
        sitekey: key,
        action: "checkout",
        theme: "dark",
        callback: onToken,
        "expired-callback": () => onToken(""),
        "error-callback": () => setFailed(true),
      });
    }

    const script = document.createElement("script");
    if (window.turnstile) {
      render();
    } else {
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = render;
      script.onerror = () => setFailed(true);
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      if (widget !== undefined && window.turnstile) window.turnstile.remove(widget);
      script.remove();
    };
  }, [onToken]);

  return (
    <div className="space-y-2">
      <div ref={ref} className="my-2 min-h-[65px]" />
      <Notice error>{failed && "Verification could not load. Refresh and try again."}</Notice>
    </div>
  );
}

// ==========================================
// APPSUMO BILLING VIEW (INSIDE DASHBOARD)
// ==========================================
export function AppSumoBilling({ onChange }) {
  const [state, setState] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    apiClient
      .get(base + "entitlement/")
      .then((r) => setState(r.data))
      .catch((e) => setError(errorText(e)));
  }, []);

  async function redeem(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const { data } = await apiClient.post(base + "redeem/", { code });
      setState(data);
      setCode("");
      setSuccess(`Lifetime Tier ${data.tier} is active. Your usage reset date stays the same when you add codes.`);
      onChange?.();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
            <KeyRound size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">
              {state?.access_type === "lifetime"
                ? `AppSumo Lifetime Tier ${state.tier}`
                : "Redeem your AppSumo purchase"}
            </h2>
            <p className="text-xs text-slate-400">One workspace. Lifetime access. No renewal payment.</p>
          </div>
        </div>
        {state?.access_type === "lifetime" && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3 py-1 text-xs font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            {state.active ? "Active" : state.status}
          </span>
        )}
      </div>

      <Notice error>{error}</Notice>
      <Notice>{success}</Notice>

      {/* Warning on initial conversion */}
      {state?.conversion_usage && (
        <Notice>
          Review this workspace before conversion: {fmt(state.conversion_usage.contacts)} stored contacts,{" "}
          {fmt(state.conversion_usage.mailboxes)} SMTP + inbox connections, and{" "}
          {fmt(state.conversion_usage.seats)} active seats. Your first code activates Tier 1 with 2,500 contacts, 2
          connections, and 1 seat. Resources above these limits must be reduced before productive operations resume.
        </Notice>
      )}

      {/* Lifetime Stats & Usage */}
      {state?.access_type === "lifetime" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Cycle reset date:</span>
            <span className="font-medium text-slate-200">{date(state.period_end)}</span>
          </div>

          {!!state.capacity_issues?.length && (
            <Notice error>
              <span className="font-semibold text-rose-100">Action needed before sending or importing:</span>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-rose-200">
                {state.capacity_issues.map((item) => (
                  <li key={item.resource}>
                    Reduce {item.resource}: {fmt(item.used)} used / {fmt(item.limit)} allowed.
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium">
                <Link to="/recipients" className="underline hover:text-white">Manage contacts</Link>
                <Link to="/settings" className="underline hover:text-white">Manage users</Link>
                <Link to="/smtp" className="underline hover:text-white">Manage SMTP</Link>
                <Link to="/mail-workspace" className="underline hover:text-white">Manage inboxes</Link>
              </div>
            </Notice>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Send size={14} className="text-cyan-400" />
                Email sends
              </div>
              <p className="mt-2 text-base font-semibold text-white">
                {fmt(state.usage.emails_sent)}{" "}
                <span className="text-xs font-normal text-slate-500">/ {fmt(state.limits.emails)}</span>
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Mail size={14} className="text-cyan-400" />
                Lead Hunter imports
              </div>
              <p className="mt-2 text-base font-semibold text-white">
                {fmt(state.usage.imports)}{" "}
                <span className="text-xs font-normal text-slate-500">/ {fmt(state.limits.imports)}</span>
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Server size={14} className="text-cyan-400" />
                Mailbox allowance
              </div>
              <p className="mt-2 text-base font-semibold text-white">
                {state.limits.mailboxes}{" "}
                <span className="text-xs font-normal text-slate-500">connections</span>
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Users size={14} className="text-cyan-400" />
                Active seats
              </div>
              <p className="mt-2 text-base font-semibold text-white">
                {state.limits.seats}{" "}
                <span className="text-xs font-normal text-slate-500">admins & members</span>
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            {fmt(state.usage.emails_reserved)} sends awaiting review · {fmt(state.limits.contacts)} stored contacts · Two Lead Hunter devices per seat.
          </p>

          <div className="flex flex-wrap gap-4 border-y border-slate-800/60 py-3 text-xs font-medium text-cyan-400">
            <Link to="/smtp" className="inline-flex items-center gap-1 hover:text-cyan-300">
              Connect sending account <ExternalLink size={12} />
            </Link>
            <Link to="/lead-hunter" className="inline-flex items-center gap-1 hover:text-cyan-300">
              Set up Lead Hunter <ExternalLink size={12} />
            </Link>
            <Link to="/mail-workspace" className="inline-flex items-center gap-1 hover:text-cyan-300">
              Open Mail Workspace <ExternalLink size={12} />
            </Link>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Redeemed Codes</p>
            <ul className="divide-y divide-slate-800/60 rounded-xl border border-slate-800/80 bg-slate-950/40 text-xs">
              {state.codes.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <span className="font-mono text-cyan-300">{c.masked_code}</span>
                  <span className="text-slate-400">
                    <span className={c.revoked ? "text-rose-400 font-medium" : "text-emerald-400 font-medium"}>
                      {c.revoked ? "Revoked" : "Redeemed"}
                    </span>{" "}
                    · {date(c.redeemed_at)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Code Redemption Input Form */}
      {getUser().role === "admin" && (
        <form onSubmit={redeem} className="space-y-4 pt-2">
          {state?.tier === 5 ? (
            <Notice>Tier 5 is the maximum tier. Additional codes cannot be stacked in this workspace.</Notice>
          ) : (
            <div className="space-y-3">
              <Field
                label="Stack or Activate an AppSumo Code"
                hint="Codes apply to this workspace. Active paid subscribers need a separate account with a different email."
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                required
                maxLength={200}
                placeholder={codePlaceholder}
              />
              <button
                type="submit"
                disabled={busy || !code.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-900/20 transition-all hover:bg-cyan-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowRight size={16} />}
                {busy ? "Activating..." : state?.access_type === "lifetime" ? "Add another code" : "Activate lifetime access"}
              </button>
            </div>
          )}
        </form>
      )}
    </section>
  );
}

// ==========================================
// PUBLIC ONBOARDING & SIGNUP COMPONENT
// ==========================================
export default function AppSumo() {
  const [catalog, setCatalog] = useState(null);
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "", organization_name: "", code: "", otp: "" });
  const [challenge, setChallenge] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    apiClient
      .get(base + "offers/")
      .then((r) => setCatalog(r.data))
      .catch((e) => setError(errorText(e)));
  }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!challenge) {
        const r = await apiClient.post(base + "signup/start/", { email: form.email, turnstile_token: token });
        setChallenge(r.data.challenge_id);
      } else {
        await apiClient.post(base + "signup/complete/", { ...form, challenge_id: challenge });
        setComplete(true);
        setForm({ name: "", username: "", email: "", password: "", organization_name: "", code: "", otp: "" });
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const tiers = catalog?.offers?.[0]?.tiers || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-cyan-500 selection:text-white">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Navigation Bar */}
        <header className="flex items-center justify-between border-b border-slate-900 pb-6">
          <Link to="/" className="transition-opacity hover:opacity-90">
            <BrandLogo className="h-8 w-auto" />
          </Link>
          <Link
            to="/login"
            className="rounded-lg border border-slate-800 bg-slate-900/60 px-3.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-700 hover:text-white"
          >
            Sign in
          </Link>
        </header>

        {/* Main Content Grid */}
        <main className="grid gap-10 py-12 lg:grid-cols-[minmax(0,1.2fr)_22rem] lg:items-start">
          <div className="space-y-8">
            <div className="space-y-3">
              <span className="inline-block rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-400">
                Mail Flow for AppSumo
              </span>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Activate your lifetime access
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
                Enter the code from your AppSumo account to set up your Mail Flow workspace. AppSumo processed your purchase; this form unlocks and sets up your instance.
              </p>
            </div>

            {/* Visual Process Steps */}
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Verify your email", num: "1" },
                { label: "Redeem code", num: "2" },
                { label: "Start workspace", num: "3" },
              ].map((step) => (
                <div
                  key={step.num}
                  className="flex items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3.5 text-xs font-medium text-slate-300 shadow-sm"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-[11px] font-bold text-cyan-400">
                    {step.num}
                  </div>
                  <span>{step.label}</span>
                </div>
              ))}
            </div>

            <Notice error>{error}</Notice>

            {/* Authenticated / Success / Form Switching */}
            {isAuthenticated() ? (
              <AppSumoBilling />
            ) : complete ? (
              <div className="space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-8 text-center backdrop-blur-md">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                  <ShieldCheck size={28} />
                </div>
                <h2 className="text-2xl font-bold text-white">Your lifetime workspace is ready!</h2>
                <p className="text-sm text-slate-400">
                  Your code has been verified and your workspace is provisioned.
                </p>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition-all hover:bg-cyan-500"
                >
                  Sign in to Mail Flow <ArrowRight size={16} />
                </Link>
              </div>
            ) : (
              <form
                onSubmit={submit}
                className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md"
              >
                <div>
                  <h2 className="text-lg font-semibold text-white">Redeem your AppSumo voucher</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Already registered?{" "}
                    <Link to="/login" className="text-cyan-400 hover:underline">
                      Sign in first
                    </Link>{" "}
                    to attach this code to your account.
                  </p>
                </div>

                {catalog && !catalog.redemption_enabled && (
                  <Notice>Redemption is not open yet. Your code will not be consumed.</Notice>
                )}

                <div className="space-y-4">
                  {[
                    ["name", "Full Name", "text", "Jane Doe"],
                    ["username", "Username", "text", "jane"],
                    ["organization_name", "Workspace Name", "text", "Acme Growth Labs"],
                    ["email", "Email Address", "email", "jane@company.com"],
                    ["password", "Password", "password", "••••••••"],
                    ["code", "AppSumo Code", "text", codePlaceholder],
                  ].map(([key, label, type, placeholder]) => (
                    <Field
                      key={key}
                      label={label}
                      type={type}
                      placeholder={placeholder}
                      value={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      required
                      disabled={key === "email" && !!challenge}
                      maxLength={key === "code" ? 200 : key === "password" ? 128 : 150}
                      autoComplete={key === "password" ? "new-password" : key === "username" ? "username" : "off"}
                    />
                  ))}
                </div>

                {challenge ? (
                  <div className="space-y-3 rounded-xl border border-cyan-800/40 bg-cyan-950/20 p-4">
                    <Field
                      label="6-Digit Verification Code"
                      hint="Check your email inbox for the single-use OTP code."
                      value={form.otp}
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="123456"
                      required
                      onChange={(e) => setForm({ ...form, otp: e.target.value })}
                    />
                    <button
                      type="button"
                      className="text-xs font-medium text-cyan-400 underline hover:text-cyan-300"
                      onClick={() => {
                        setChallenge("");
                        setForm({ ...form, otp: "" });
                      }}
                    >
                      Use another email or request a new code
                    </button>
                  </div>
                ) : (
                  <Verification onToken={setToken} />
                )}

                <button
                  type="submit"
                  disabled={busy || !catalog?.redemption_enabled}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-950/50 transition-all hover:bg-cyan-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowRight size={16} />}
                  {busy ? "Processing..." : challenge ? "Complete Registration" : "Verify Email & Continue"}
                </button>
              </form>
            )}
          </div>

          {/* Right Column Help / Information Aside */}
          <aside className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur-sm">
              <div className="flex items-center gap-2.5 text-sm font-semibold text-white">
                <KeyRound size={16} className="text-cyan-400" />
                Before you activate
              </div>
              <ul className="mt-4 space-y-3 text-xs leading-relaxed text-slate-400">
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-cyan-400" />
                  Use the code displayed inside your AppSumo customer dashboard.
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-cyan-400" />
                  One code unlocks Tier 1. Extra codes stack onto the existing workspace.
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-cyan-400" />
                  Existing free accounts retain historical campaign assets after upgrade.
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-cyan-400" />
                  Active monthly subscribers should register under an alternative email address.
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/20 p-5 text-xs text-slate-500">
              Need technical support during activation? Contact support or consult the documentation within your AppSumo product instructions.
            </div>
          </aside>
        </main>

        {/* Bottom Tier Reference Matrix */}
        <div className="pb-16 pt-4">
          <TierReference tiers={tiers} />
        </div>
      </div>
    </div>
  );
}

// ==========================================
// APPSUMO OWNER / ADMIN CONSOLE
// ==========================================
export function AppSumoOwner() {
  const [data, setData] = useState(null);
  const [offers, setOffers] = useState([]);
  const [offer, setOffer] = useState("");
  const [env, setEnv] = useState("test");
  const [count, setCount] = useState(1000);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [offset, setOffset] = useState(0);
  const [lookup, setLookup] = useState("");
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState(null);
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");

  async function load() {
    const results = await Promise.all([
      apiClient.get(ownerUrl, { params: { offset } }),
      apiClient.get(base + "offers/"),
    ]);
    setData(results[0].data);
    setOffers(results[1].data.offers);
    setOffer((v) => v || String(results[1].data.offers[0]?.id || ""));
  }

  useEffect(() => {
    load().catch((e) => setError(errorText(e)));
  }, [offset]);

  async function action(body) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await apiClient.post(ownerUrl, body);
      if (body.action === "refund_preview") {
        setPreview(r.data);
      } else if (body.action === "lookup") {
        setData((v) => ({ ...v, codes: [r.data.code] }));
        setLookup("");
      } else {
        setMessage("Changes saved successfully.");
        setSelected(null);
        if (body.action === "refund_confirm") {
          setPreview(null);
          setCsv("");
        }
        await load();
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function exportBatch(id) {
    setBusy(true);
    setError("");
    try {
      const r = await apiClient.post(
        ownerUrl,
        { action: "export", batch_id: id },
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `MailFlow-AppSumo-${id}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8 text-slate-100">
      {/* Console Header */}
      <div className="border-b border-slate-800 pb-5">
        <h2 className="text-2xl font-bold tracking-tight text-white">AppSumo Lifetime Offer Management</h2>
        <p className="mt-1 text-sm text-slate-400">
          Provision inventory, audit redemptions, and process reconciled refunds.
        </p>
      </div>

      <Notice error>{error}</Notice>
      <Notice>{message}</Notice>

      {/* Batch Code Generation */}
      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-md backdrop-blur-sm">
        <div>
          <h3 className="text-base font-semibold text-white">Generate Code Batch</h3>
          <p className="text-xs text-slate-400">
            Choose how many codes to create. Batches generate inactive until you activate them.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <CustomSelect
            ariaLabel="Offer version"
            value={offer}
            onChange={setOffer}
            options={offers.map((o) => ({ value: String(o.id), label: `Version: ${o.version}` }))}
          />
          <CustomSelect
            ariaLabel="Batch environment"
            value={env}
            onChange={setEnv}
            options={[
              { value: "test", label: "Test Environment" },
              { value: "production", label: "Production Environment" },
            ]}
          />
          <Field
            label="Codes to Generate"
            type="number"
            min={1}
            max={10000}
            step={1}
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
          <button
            disabled={busy || !offer || !data?.flags?.code_admin || Number(count) < 1 || Number(count) > 10000}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cyan-500 disabled:opacity-50"
            onClick={() => action({ action: "generate", offer_id: Number(offer), environment: env, count: Number(count) })}
          >
            <KeyRound size={16} />
            Generate Batch
          </button>
        </div>
        <p className="text-xs text-slate-500">Allowed range: 1 to 10,000 codes per batch. Export remains a single-column CSV with no header.</p>
      </section>

      {/* Batch Inventory Table */}
      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-md backdrop-blur-sm">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-semibold text-white">Code Inventory</h3>
            <p className="text-xs text-slate-400">Available pool across all active batches</p>
          </div>
          <span className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1 text-xs font-mono font-medium text-cyan-400">
            {fmt(data?.unused_codes)} unused active production codes
          </span>
        </div>

        <div className="divide-y divide-slate-800/80">
          {data?.batches?.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div className="space-y-1">
                <p className="font-mono text-xs font-medium text-slate-200">{b.id}</p>
                <p className="text-xs text-slate-500">
                  Env: <span className="text-slate-300">{b.environment}</span> · Status:{" "}
                  <span className={b.active ? "text-emerald-400 font-medium" : "text-amber-400 font-medium"}>
                    {b.active ? "Active" : "Inactive"}
                  </span>{" "}
                  · {fmt(b.code_count)} codes · Created: {date(b.created_at)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={busy || !data?.flags?.code_admin}
                  className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                  onClick={() => exportBatch(b.id)}
                >
                  Export CSV
                </button>
                <button
                  disabled={busy}
                  className="rounded-lg border border-cyan-600/40 bg-cyan-950/40 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-900/60 disabled:opacity-50"
                  onClick={() =>
                    action({
                      action: b.active ? "deactivate_batch" : "activate_batch",
                      batch_id: b.id,
                    })
                  }
                >
                  {b.active ? "Deactivate Unused" : "Activate Batch"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Code Records & Search */}
      <section className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-md backdrop-blur-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-white">Redemption Registry</h3>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              action({ action: "lookup", code: lookup });
            }}
          >
            <input
              className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              placeholder="Find specific code..."
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              maxLength={200}
            />
            <button
              disabled={busy || !lookup.trim()}
              className="rounded-xl bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              <Search size={14} />
            </button>
          </form>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 text-slate-400">
              <tr>
                <th className="p-3">Code</th>
                <th className="p-3">Workspace</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {data?.codes?.map((c) => (
                <tr key={c.id} className="hover:bg-slate-900/30">
                  <td className="p-3 font-mono text-cyan-300">{c.masked_code}</td>
                  <td className="p-3 text-slate-400">{c.organization_id || "Unassigned"}</td>
                  <td className="p-3">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${c.revoked
                          ? "bg-rose-950/60 text-rose-300"
                          : c.redeemed_at
                            ? "bg-emerald-950/60 text-emerald-300"
                            : "bg-slate-800 text-slate-400"
                        }`}
                    >
                      {c.revoked ? "Revoked" : c.redeemed_at ? "Redeemed" : "Unused"}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      className="text-xs font-medium text-cyan-400 hover:underline"
                      onClick={() => {
                        setSelected(c);
                        setReason("");
                        setReference("");
                      }}
                    >
                      {c.revoked ? "Reinstatement" : "Revocation"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Navigation */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>
            Records: <strong className="text-slate-200">{offset + 1}</strong> to{" "}
            <strong className="text-slate-200">
              {Math.min(offset + 200, data?.code_count || 0)}
            </strong>{" "}
            of <strong className="text-slate-200">{fmt(data?.code_count)}</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={!offset || busy}
              onClick={() => setOffset(Math.max(0, offset - 200))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-800 px-2.5 py-1 hover:bg-slate-800 disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <button
              disabled={busy || offset + 200 >= (data?.code_count || 0)}
              onClick={() => setOffset(offset + 200)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-800 px-2.5 py-1 hover:bg-slate-800 disabled:opacity-40"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Selection Confirmation Panel */}
        {selected && !selected.send && (
          <form
            className="space-y-4 rounded-xl border border-amber-500/30 bg-amber-950/20 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              action({
                action: selected.revoked ? "reinstate" : "revoke",
                code_id: selected.id,
                reason,
                reference,
              });
            }}
          >
            <p className="text-xs font-medium text-amber-200">
              Managing {selected.masked_code}:{" "}
              {selected.revoked
                ? "Restore access and reactivate code."
                : "Revoke code and recalculate workspace limits."}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="AppSumo Reference"
                placeholder="Invoice or Refund ID"
                value={reference}
                required
                onChange={(e) => setReference(e.target.value)}
                maxLength={128}
              />
              <Field
                label="Reason"
                placeholder="e.g. Customer refund processed via AppSumo"
                value={reason}
                required
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                disabled={busy}
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500"
              >
                Confirm {selected.revoked ? "Reinstatement" : "Revocation"}
              </button>
              <button
                type="button"
                className="text-xs text-slate-400 hover:text-white"
                onClick={() => setSelected(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Reconcile Refund CSV */}
      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-md backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="text-cyan-400" size={20} />
          <h3 className="text-base font-semibold text-white">Reconcile Bulk Refund CSV</h3>
        </div>
        <p className="text-xs text-slate-400">
          Required headers: <code className="text-cyan-300">code,reference,reason</code>. Up to 1,000 unique lines.
        </p>
        <label className="block space-y-1.5 text-sm font-medium text-slate-300">
          <span>Refund CSV</span>
          <textarea
            className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-200 placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
            rows={4}
            placeholder={`${codePlaceholder},REF-9988,Customer returned product`}
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              setPreview(null);
            }}
          />
        </label>
        <button
          className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-50"
          disabled={busy || !csv.trim()}
          onClick={() => action({ action: "refund_preview", csv })}
        >
          Validate and preview
        </button>

        {preview && (
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-xs font-medium text-emerald-400">
              {preview.rows.length} code revocations ready for review
            </p>
            <ul className="max-h-48 divide-y divide-slate-800/60 overflow-auto font-mono text-xs text-slate-400">
              {preview.rows.map((r) => (
                <li key={r.code_id} className="py-1.5">
                  {r.masked_code} · Ref: {r.reference} · {r.reason}
                </li>
              ))}
            </ul>
            <button
              className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500"
              disabled={busy}
              onClick={() => action({ action: "refund_confirm", preview_id: preview.preview_id })}
            >
              Confirm reviewed refunds
            </button>
          </div>
        )}
      </section>

      {/* Sending Reconciliation */}
      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-md backdrop-blur-sm">
        <div>
          <h3 className="text-base font-semibold text-white">Sending Reservation Reconciliation</h3>
          <p className="text-xs text-slate-400">
            Unresolved dispatches remain reserved against allowance. Verify provider logs prior to settlement.
          </p>
        </div>

        <div className="space-y-2">
          {data?.unresolved_sends?.length === 0 ? (
            <p className="text-xs text-slate-500">No pending unverified sends.</p>
          ) : (
            data?.unresolved_sends?.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-xs"
              >
                <span className="font-mono text-slate-300">
                  #{r.id} · Workspace: {r.usage__organization_id} · State: {r.state} · {date(r.created_at)}
                </span>
                <button
                  className="font-medium text-cyan-400 hover:underline"
                  onClick={() => {
                    setSelected({ send: r.id });
                    setReason("");
                  }}
                >
                  Inspect & Settle
                </button>
              </div>
            ))
          )}
        </div>

        {selected?.send && (
          <form className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4" onSubmit={(e) => e.preventDefault()}>
            <Field
              label="Provider Evidence & Log Details"
              placeholder="e.g. Verified via Postmark webhook log ID: 12345"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex gap-2">
              {["sent", "failed"].map((state) => (
                <button
                  key={state}
                  disabled={busy || !reason}
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40"
                  onClick={() =>
                    action({
                      action: "resolve_send",
                      reservation_id: selected.send,
                      state,
                      reason,
                    })
                  }
                >
                  Mark as {state}
                </button>
              ))}
              <button
                type="button"
                className="px-2 text-xs text-slate-400 hover:text-white"
                onClick={() => setSelected(null)}
              >
                Dismiss
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Audit History Log */}
      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-md backdrop-blur-sm">
        <h3 className="text-base font-semibold text-white">Audit Log</h3>
        <ul className="max-h-64 divide-y divide-slate-800/60 overflow-auto font-mono text-xs text-slate-400">
          {data?.audit?.map((a) => (
            <li key={a.id} className="py-2">
              <span className="text-slate-500">{date(a.created_at)}</span> ·{" "}
              <strong className="text-slate-200">{a.action}</strong> · {a.reference}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
