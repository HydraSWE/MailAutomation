import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CalendarClock, Check, CheckCircle2, Clock, CreditCard, Loader2, Sparkles, XCircle } from "lucide-react";
import api from "../services/api";
import {
  createAccountCustomInvoice,
  createAccountInvoice,
  getAccountCustomQuote,
  getPlans,
  submitAccountCustomQuote,
} from "../services/billingApi";
import { getUser } from "../utils/auth";
import CustomSelect from "../components/common/CustomSelect";
import { useAutoDismiss } from "../hooks/useAutoDismiss";

const paidNetworks = [
  ["bsc", "BNB Smart Chain (BEP20 USDT)"],
  ["tron", "Tron (TRC20 USDT)"],
  ["ton", "TON (Jetton USDT)"],
  ["ethereum", "Ethereum (ERC20 USDT)"],
];

const customAddonPrices = { email_10k: 120, admin: 150, user: 20, smtp: 300, recipient_10k: 100, max_self_serve_price: 15000 };

function calculateCustomPricing(customPlan, premiumPlan, limits) {
  if (!customPlan || !premiumPlan || !limits) {
    return { base: 0, addons: 0, discount: 0, total: 0 };
  }
  const premiumWas = Number(premiumPlan.original_price_bdt || 0);
  const premiumPayable = Number(premiumPlan.price_bdt || premiumWas);
  const base = Number(premiumPlan.discount_percent || 0) > 0 && premiumWas > premiumPayable
    ? premiumWas
    : premiumPayable;

  const rates = {
    email_10k: Number(customPlan?.addon_prices?.email_10k || premiumPlan?.addon_prices?.email_10k || customAddonPrices.email_10k),
    admin: Number(customPlan?.addon_prices?.admin || premiumPlan?.addon_prices?.admin || customAddonPrices.admin),
    user: Number(customPlan?.addon_prices?.user || premiumPlan?.addon_prices?.user || customAddonPrices.user),
    smtp: Number(customPlan?.addon_prices?.smtp_inbox || premiumPlan?.addon_prices?.smtp_inbox || customAddonPrices.smtp),
    recipient_10k: Number(customPlan?.addon_prices?.recipient_10k || premiumPlan?.addon_prices?.recipient_10k || customAddonPrices.recipient_10k),
  };

  const emailExtra = Math.max(0, Math.ceil(((limits.email_limit || 0) - (premiumPlan.email_limit || 0)) / 10000)) * rates.email_10k;
  const adminExtra = Math.max(0, (limits.max_admins || 0) - (premiumPlan.max_admins || 0)) * rates.admin;
  const userExtra = Math.max(0, (limits.max_users || 0) - (premiumPlan.max_users || 0)) * rates.user;
  const smtpExtra = Math.max(0, (limits.max_smtp_accounts || 0) - (premiumPlan.max_smtp_accounts || 0)) * rates.smtp;
  const recipientExtra = Math.max(0, Math.ceil(((limits.max_recipients || 0) - (premiumPlan.max_recipients || 0)) / 10000)) * rates.recipient_10k;

  const addons = emailExtra + adminExtra + userExtra + smtpExtra + recipientExtra;
  const subtotal = base + addons;
  const discountPercent = Number(customPlan.discount_percent || 0);
  const discount = Math.round(subtotal * (discountPercent / 100));
  const total = subtotal - discount;

  return { base, addons, discount, discountPercent, total };
}

export default function AccountAdmin() {
  const navigate = useNavigate();
  const role = getUser().role;

  const [account, setAccount] = useState(null);
  const [plans, setPlans] = useState([]);
  const [activeQuote, setActiveQuote] = useState(null);
  const [upgrade, setUpgrade] = useState({ plan_slug: "custom", network: "bsc" });
  const [customLimits, setCustomLimits] = useState({
    email_limit: 300000,
    max_admins: 8,
    max_users: 80,
    max_smtp_accounts: 15,
    max_recipients: 50000,
  });
  const [quoteNotes, setQuoteNotes] = useState("");
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useAutoDismiss("");
  const [successMessage, setSuccessMessage] = useAutoDismiss("");

  const load = () =>
    Promise.all([
      api.get("/account/"),
      getPlans(),
      getAccountCustomQuote().catch(() => ({ quote: null })),
    ]).then(([a, p, q]) => {
      setAccount(a.data);
      setPlans(p);
      if (q?.quote) {
        setActiveQuote(q.quote);
      }

      const paidPlans = p.filter((plan) => !plan.is_free);
      const currentPlanSlug = a.data?.subscription?.plan;
      const defaultPlanSlug =
        paidPlans.find((plan) => plan.slug === currentPlanSlug)?.slug ||
        "custom";

      setUpgrade((prev) => ({
        ...prev,
        plan_slug: prev.plan_slug || defaultPlanSlug,
      }));

      const premiumPlus = p.find((plan) => plan.slug === "premium-plus");
      if (premiumPlus) {
        setCustomLimits({
          email_limit: Math.max(a.data.monthly_email_limit || 0, premiumPlus.email_limit || 0, 300000),
          max_admins: Math.max(a.data.max_admins || 0, premiumPlus.max_admins || 0, 8),
          max_users: Math.max(a.data.max_users || 0, premiumPlus.max_users || 0, 80),
          max_smtp_accounts: Math.max(a.data.max_smtp_accounts || 0, premiumPlus.max_smtp_accounts || 0, 15),
          max_recipients: Math.max(a.data.max_recipients || 0, premiumPlus.max_recipients || 0, 50000),
        });
      }
    });

  useEffect(() => {
    load().catch((e) => {
      setError(e.response?.data?.detail || "Unable to load account details.");
    });
  }, []);

  const premiumPlusPlan = plans.find((plan) => plan.slug === "premium-plus");
  const customPlan = plans.find((plan) => plan.slug === "custom");
  const pricing = calculateCustomPricing(customPlan, premiumPlusPlan, customLimits);

  const selfServeCeiling = Number(customPlan?.addon_prices?.max_self_serve_price || customAddonPrices.max_self_serve_price || 15000);
  const isBiggerQuota = Boolean(customLimits && pricing.total > selfServeCeiling);

  const beginUpgrade = async () => {
    setUpgrading(true);
    setError("");
    setSuccessMessage("");

    try {
      if (upgrade.plan_slug === "custom" && isBiggerQuota) {
        // Mode 2: Submit custom enterprise quote for approval
        const quote = await submitAccountCustomQuote({
          requested_limits: customLimits,
          notes: quoteNotes,
        });
        setActiveQuote(quote);
        setSuccessMessage(`Custom quote #${quote.quote_number} submitted for platform review.`);
      } else {
        // Mode 1: Standard or Self-Serve Custom instant checkout
        const freshIdempotencyKey = crypto.randomUUID();
        const invoice = upgrade.plan_slug === "custom"
          ? await createAccountCustomInvoice({
            network: upgrade.network,
            limits: customLimits,
            idempotency_key: freshIdempotencyKey,
          })
          : await createAccountInvoice({ ...upgrade, idempotency_key: freshIdempotencyKey });
        navigate(`/payment/${invoice.id || "current"}`);
      }
    } catch (e) {
      setError(
        e.response?.data?.detail ||
        e.response?.data?.otp ||
        "Unable to process subscription change."
      );
    } finally {
      setUpgrading(false);
    }
  };

  if (!account) {
    return <div className="text-slate-400 p-6">Loading account...</div>;
  }

  const unlimited = (limit) => (limit === 0 ? "Unlimited" : limit);

  const cards = [
    ["Administrators", account.admin_count, account.max_admins],
    ["Users", account.user_count, account.max_users],
    ["SMTP Accounts", account.smtp_count, account.max_smtp_accounts],
    ["Daily Emails", account.usage?.daily_sent ?? 0, unlimited(account.daily_email_limit)],
    ["Weekly Emails", account.usage?.weekly_sent ?? 0, unlimited(account.weekly_email_limit)],
    ["30-Day Emails", account.usage?.monthly_sent ?? 0, account.monthly_email_limit],
  ];

  return (
    <div className="space-y-6">
      {/* Header & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">{account.name}</h1>
          <p className="text-xs text-slate-400 mt-1">
            Account status:{" "}
            <span
              className={
                account.status === "active"
                  ? "text-emerald-400 font-semibold capitalize"
                  : "text-rose-400 font-semibold capitalize"
              }
            >
              {account.status}
            </span>
            {" : ID: "}
            <span className="font-mono text-slate-500">
              {account.slug || (typeof account.id === "string" && account.id.length > 18 ? `org_${account.id.slice(0, 8)}` : `org_${account.id}`)}
            </span>
          </p>
        </div>

        {account.subscription && (
          <div className="flex items-center gap-3.5 px-4 py-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 grid place-items-center shrink-0">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <p className="font-black text-sm text-white">{account.subscription.plan_name}</p>
              <p className="text-[11px] text-slate-400">
                Renews or expires{" "}
                <span className="text-indigo-300 font-semibold">
                  {new Date(account.subscription.current_period_end).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Active Quote Tracker Banner */}
      {activeQuote?.status === "pending_review" && (
        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-5 transition-all">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 grid place-items-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">Custom Quote Under Platform Review</h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-300 font-bold">
                  #{activeQuote.quote_number}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Your enterprise quote request for{" "}
                <strong>{Number(activeQuote.requested_limits?.email_limit || 0).toLocaleString()} emails, {activeQuote.requested_limits?.max_smtp_accounts} SMTP inboxes</strong> is currently being reviewed by our platform team. You will receive an email notification when your 72-hour locked invoice is ready.
              </p>
              <p className="text-[11px] text-cyan-300 font-semibold mt-2">
                Status: Pending Platform Owner Review
              </p>
            </div>
          </div>
        </div>
      )}

      {activeQuote?.status === "invoiced" && activeQuote.invoice && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 transition-all">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 grid place-items-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">Custom Quote Approved & Invoiced (72-Hour Lock)</h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold">
                  #{activeQuote.quote_number}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                The platform owner approved your custom quote at{" "}
                <strong>৳{Number(activeQuote.quoted_price_bdt || 0).toLocaleString()} / 30 days</strong>.
                {activeQuote.owner_notes && (
                  <span className="block mt-1 text-slate-400 italic">
                    Note: &ldquo;{activeQuote.owner_notes}&rdquo;
                  </span>
                )}
              </p>
              <div className="mt-3">
                <button
                  onClick={() => navigate(`/payment/${activeQuote.invoice.id}`)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-md"
                >
                  <ArrowRight className="w-4 h-4" /> Proceed to USDT Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeQuote?.status === "rejected" && (
        <div className="flex items-start justify-between gap-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 transition-all">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 grid place-items-center shrink-0">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">Custom Quote Request Declined</h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 font-bold">
                  #{activeQuote.quote_number}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {activeQuote.rejection_reason || "Your requested limits could not be approved at this time. Please adjust your capacity requirements or contact support."}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveQuote(null)}
            className="text-xs text-slate-400 hover:text-slate-200 font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Success Alert */}
      {successMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-2xl text-sm flex items-center gap-2.5">
          <Check className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-2xl text-sm">
          {error}
        </div>
      )}

      {/* Usage Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(([label, used, limit]) => (
          <div
            key={label}
            className="p-5 bg-slate-900 border border-slate-800 rounded-2xl"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
            <p className="text-2xl font-black text-white mt-1.5">
              {typeof used === "number" ? used.toLocaleString() : used}{" "}
              <span className="text-sm font-normal text-slate-500">
                / {typeof limit === "number" && limit > 0 ? limit.toLocaleString() : limit}
              </span>
            </p>
            {typeof limit === "number" && limit > 0 && (
              <p className="text-xs text-indigo-400 mt-1">
                {Math.max(limit - used, 0).toLocaleString()} remaining
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Upgrade Subscription Section */}
      {role === "admin" && (
        <section className="p-6 sm:p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 grid place-items-center shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">Renew or change subscription</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Upgrades and renewals are applied automatically after your USDT transfer is confirmed on-chain.
                </p>
              </div>
            </div>

            {/* Dynamic Mode Badge */}
            <div
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-2 border self-start sm:self-auto transition-all ${upgrade.plan_slug !== "custom"
                  ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-300"
                  : isBiggerQuota
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                    : "bg-cyan-500/10 border-cyan-500/30 text-cyan-300"
                }`}
            >
              {upgrade.plan_slug !== "custom" ? (
                <span>Standard Plan Tier</span>
              ) : isBiggerQuota ? (
                <span>✨ Enterprise Quota : Admin Review Required</span>
              ) : (
                <span>⚡ Self-Serve Instant Checkout</span>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-6 relative z-30">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Plan Selected</label>
              <CustomSelect
                value={upgrade.plan_slug}
                onChange={(plan_slug) => setUpgrade({ ...upgrade, plan_slug })}
                options={[
                  { value: "custom", label: "Custom : Configure Capacity" },
                  ...plans
                    .filter((plan) => !plan.is_free && plan.slug !== "custom")
                    .map((plan) => {
                      const originalPrice = plan.original_price_bdt || plan.price_bdt;
                      const hasDiscount = Number(plan.discount_percent || 0) > 0 && originalPrice > plan.price_bdt;
                      return {
                        value: plan.slug,
                        label: hasDiscount
                          ? `${plan.name} : ৳${plan.price_bdt.toLocaleString()} / 30d (${plan.discount_percent}% off, was ৳${originalPrice.toLocaleString()})`
                          : `${plan.name} : ৳${plan.price_bdt.toLocaleString()} / 30d`,
                      };
                    }),
                ]}
                ariaLabel="Subscription plan"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Payment Network</label>
              <CustomSelect
                value={upgrade.network}
                onChange={(network) => setUpgrade({ ...upgrade, network })}
                options={paidNetworks.map(([value, label]) => ({ value, label }))}
                ariaLabel="Payment network"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={beginUpgrade}
                disabled={upgrading}
                className={`w-full py-3 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 shadow-lg active:scale-95 ${upgrade.plan_slug === "custom" && isBiggerQuota
                    ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-950/40"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/40"
                  }`}
              >
                {upgrading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : upgrade.plan_slug === "custom" && isBiggerQuota ? (
                  <>
                    <Sparkles className="w-4 h-4" /> Submit Custom Quote for Approval
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4" /> Continue to Instant Checkout
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Custom Capacity Builder Panel */}
          {upgrade.plan_slug === "custom" && customLimits && premiumPlusPlan && (
            <div className="mt-6 pt-5 border-t border-slate-800 space-y-4">

              {/* Compact Mode Status & Pricing Banner */}
              <div
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all ${
                  isBiggerQuota
                    ? "bg-amber-500/10 border-amber-500/25"
                    : "bg-indigo-500/5 border-indigo-500/20"
                }`}
              >
                <div className="flex items-start sm:items-center gap-2.5">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 mt-1 sm:mt-0 ${
                      isBiggerQuota
                        ? "bg-amber-400 shadow-[0_0_6px_#fbbf24]"
                        : "bg-emerald-400 shadow-[0_0_6px_#34d399]"
                    }`}
                  />
                  <div>
                    <h4
                      className={`text-xs font-bold ${
                        isBiggerQuota ? "text-amber-200" : "text-white"
                      }`}
                    >
                      {isBiggerQuota
                        ? "Enterprise Scale Quota"
                        : "Custom Capacity (Instant Checkout)"}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {isBiggerQuota
                        ? "Your selected limits exceed self-serve thresholds. A dedicated review will be performed and a 72-hour locked USDT invoice will be issued."
                        : "The server locks these limits into your on-chain invoice upon clicking Continue."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                  {isBiggerQuota ? (
                    <span className="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-xs border border-amber-500/30">
                      Enterprise Quote
                    </span>
                  ) : (
                    <div className="text-right">
                      <span className="text-base font-black text-emerald-400">
                        ৳{pricing.total.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-1">/ 30 days</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Slider & Number Inputs Controls */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>Quota Capacity Adjuster</span>
                  <span className="text-slate-500 font-normal normal-case">Move sliders or enter values</span>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  {/* 1. Monthly Emails */}
                  <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-200">Monthly Emails</span>
                      </div>
                      <input
                        type="number"
                        min={premiumPlusPlan.email_limit || 150000}
                        max={10000000}
                        step={10000}
                        value={customLimits.email_limit}
                        onChange={(e) => setCustomLimits({ ...customLimits, email_limit: Number(e.target.value) })}
                        className="w-28 rounded-lg bg-slate-900 border border-slate-700 px-2 py-1 text-right text-xs font-bold text-white focus:border-indigo-400 outline-none"
                      />
                    </div>
                    <input
                      type="range"
                      min={premiumPlusPlan.email_limit || 150000}
                      max={5000000}
                      step={10000}
                      value={customLimits.email_limit}
                      onChange={(e) => setCustomLimits({ ...customLimits, email_limit: Number(e.target.value) })}
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                      <span>150k</span>
                      <span>5.0M+</span>
                    </div>
                  </div>

                  {/* 2. SMTP Accounts / Inboxes */}
                  <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-200">SMTP Accounts + Inboxes</span>
                      </div>
                      <input
                        type="number"
                        min={premiumPlusPlan.max_smtp_accounts || 10}
                        max={100}
                        step={1}
                        value={customLimits.max_smtp_accounts}
                        onChange={(e) => setCustomLimits({ ...customLimits, max_smtp_accounts: Number(e.target.value) })}
                        className="w-20 rounded-lg bg-slate-900 border border-slate-700 px-2 py-1 text-right text-xs font-bold text-white focus:border-indigo-400 outline-none"
                      />
                    </div>
                    <input
                      type="range"
                      min={premiumPlusPlan.max_smtp_accounts || 10}
                      max={100}
                      step={1}
                      value={customLimits.max_smtp_accounts}
                      onChange={(e) => setCustomLimits({ ...customLimits, max_smtp_accounts: Number(e.target.value) })}
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                      <span>10</span>
                      <span>100</span>
                    </div>
                  </div>

                  {/* 3. Administrators */}
                  <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-200">Administrators</span>
                      </div>
                      <input
                        type="number"
                        min={premiumPlusPlan.max_admins || 5}
                        max={50}
                        step={1}
                        value={customLimits.max_admins}
                        onChange={(e) => setCustomLimits({ ...customLimits, max_admins: Number(e.target.value) })}
                        className="w-20 rounded-lg bg-slate-900 border border-slate-700 px-2 py-1 text-right text-xs font-bold text-white focus:border-indigo-400 outline-none"
                      />
                    </div>
                    <input
                      type="range"
                      min={premiumPlusPlan.max_admins || 5}
                      max={50}
                      step={1}
                      value={customLimits.max_admins}
                      onChange={(e) => setCustomLimits({ ...customLimits, max_admins: Number(e.target.value) })}
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                      <span>5</span>
                      <span>50</span>
                    </div>
                  </div>

                  {/* 4. Team Users */}
                  <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-200">Team Users</span>
                      </div>
                      <input
                        type="number"
                        min={premiumPlusPlan.max_users || 50}
                        max={500}
                        step={5}
                        value={customLimits.max_users}
                        onChange={(e) => setCustomLimits({ ...customLimits, max_users: Number(e.target.value) })}
                        className="w-20 rounded-lg bg-slate-900 border border-slate-700 px-2 py-1 text-right text-xs font-bold text-white focus:border-indigo-400 outline-none"
                      />
                    </div>
                    <input
                      type="range"
                      min={premiumPlusPlan.max_users || 50}
                      max={500}
                      step={5}
                      value={customLimits.max_users}
                      onChange={(e) => setCustomLimits({ ...customLimits, max_users: Number(e.target.value) })}
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                      <span>50</span>
                      <span>500</span>
                    </div>
                  </div>

                  {/* 5. Audience Database */}
                  <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-2.5 md:col-span-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-200">Audience Recipients Database</span>
                      </div>
                      <input
                        type="number"
                        min={premiumPlusPlan.max_recipients || 10000}
                        max={1000000}
                        step={10000}
                        value={customLimits.max_recipients}
                        onChange={(e) => setCustomLimits({ ...customLimits, max_recipients: Number(e.target.value) })}
                        className="w-28 rounded-lg bg-slate-900 border border-slate-700 px-2 py-1 text-right text-xs font-bold text-white focus:border-indigo-400 outline-none"
                      />
                    </div>
                    <input
                      type="range"
                      min={premiumPlusPlan.max_recipients || 10000}
                      max={1000000}
                      step={10000}
                      value={customLimits.max_recipients}
                      onChange={(e) => setCustomLimits({ ...customLimits, max_recipients: Number(e.target.value) })}
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                      <span>10,000</span>
                      <span>1,000,000</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Enterprise Mode Notes Box */}
              {isBiggerQuota && (
                <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-200">
                      Special Infrastructure & Support Requirements (Optional)
                    </span>
                    <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">
                      Reviewed by Platform Owner
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    value={quoteNotes}
                    onChange={(e) => setQuoteNotes(e.target.value)}
                    placeholder="e.g. Dedicated IP warmup, custom deliverability SLA, or high concurrency API access..."
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-400 outline-none"
                  />
                </div>
              )}

              {/* Self-Serve Mode Pricing Breakdown */}
              {!isBiggerQuota && (
                <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs space-y-1.5">
                  <div className="flex justify-between text-slate-400">
                    <span>Premium+ Base Price</span>
                    <span className="text-slate-200 font-semibold">৳{pricing.base.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Selected Extra Capacity Addons</span>
                    <span className="text-indigo-300 font-semibold">+৳{pricing.addons.toLocaleString()}</span>
                  </div>
                  {pricing.discount > 0 && (
                    <div className="flex justify-between text-slate-400">
                      <span>Custom Volume Discount ({pricing.discountPercent}%)</span>
                      <span className="text-emerald-400 font-semibold">-৳{pricing.discount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-xs">
                    <span className="text-white">Payable (30 Days)</span>
                    <span className="text-emerald-300 font-extrabold text-sm">৳{pricing.total.toLocaleString()}</span>
                  </div>
                </div>
              )}

            </div>
          )}
        </section>
      )}

      {/* User Management - redirect to Settings */}
      {role === "admin" && (
        <section className="p-6 bg-slate-900 border border-slate-800 rounded-3xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-white text-base">Team members</h2>
              <p className="text-xs text-slate-400 mt-1">
                Create, edit, and manage user accounts and access permissions for your organization.
              </p>
            </div>
            <button
              onClick={() => navigate("/settings")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition shadow-md"
            >
              <ArrowRight className="w-4 h-4" /> Manage users
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
