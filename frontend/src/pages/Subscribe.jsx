import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  Coins,
  Eye,
  EyeOff,
  Layers,
  Loader2,
  Lock,
  LockKeyhole,
  LogIn,
  Mail,
  Send,
  ShieldAlert,
  ShieldCheck,
  User,
  X,
  Zap,
} from "lucide-react";
import {
  apiError,
  createCustomInvoice,
  createInvoice,
  getPlans,
  startCheckoutEmail,
  verifyCheckoutEmail,
} from "../services/billingApi";

const networks = [
  {
    id: "bsc",
    name: "BNB Smart Chain",
    protocol: "BEP-20",
    badge: "Lowest Fee",
    fee: "~$0.10 fee",
    speed: "~3s confirmation",
    accentColor: "emerald",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 32 32" fill="none">
        <path d="M16 32C24.8366 32 32 24.8366 32 16C32 7.16344 24.8366 0 16 0C7.16344 0 0 7.16344 0 16C0 24.8366 7.16344 32 16 32Z" fill="#F0B90B"/>
        <path d="M16 6.5L20.25 10.75L16 15L11.75 10.75L16 6.5ZM21.75 12.25L26 16.5L21.75 20.75L17.5 16.5L21.75 12.25ZM10.25 12.25L14.5 16.5L10.25 20.75L6 16.5L10.25 12.25ZM16 18L20.25 22.25L16 26.5L11.75 22.25L16 18Z" fill="white"/>
      </svg>
    ),
  },
  {
    id: "tron",
    name: "TRON",
    protocol: "TRC-20",
    badge: "Popular",
    fee: "~$1.50 fee",
    speed: "~1m confirmation",
    accentColor: "indigo",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 32 32" fill="none">
        <path d="M16 32C24.8366 32 32 24.8366 32 16C32 7.16344 24.8366 0 16 0C7.16344 0 0 7.16344 0 16C0 24.8366 7.16344 32 16 32Z" fill="#EB0029"/>
        <path d="M24.7 9.8L7.6 6.5L14.4 25.5L24.7 9.8ZM19.5 11.2L11.5 9.7L15.3 14.8L19.5 11.2ZM15.3 17.5L12.5 21.6L10.3 11.3L15.3 17.5ZM17.1 14.8L21.7 11.5L16.2 21.5L17.1 14.8Z" fill="white"/>
      </svg>
    ),
  },
  {
    id: "ton",
    name: "TON Network",
    protocol: "Jetton",
    badge: "Ultra Fast",
    fee: "~$0.05 fee",
    speed: "Instant confirmation",
    accentColor: "cyan",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 32 32" fill="none">
        <path d="M16 32C24.8366 32 32 24.8366 32 16C32 7.16344 24.8366 0 16 0C7.16344 0 0 7.16344 0 16C0 24.8366 7.16344 32 16 32Z" fill="#0088CC"/>
        <path d="M22.5 9.5H9.5L8 12L16 24.5L24 12L22.5 9.5ZM11.2 11.5H20.8L16 19L11.2 11.5Z" fill="white"/>
      </svg>
    ),
  },
  {
    id: "ethereum",
    name: "Ethereum",
    protocol: "ERC-20",
    badge: "Standard",
    fee: "~$3-$8 gas",
    speed: "~3m confirmation",
    accentColor: "slate",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 32 32" fill="none">
        <path d="M16 32C24.8366 32 32 24.8366 32 16C32 7.16344 24.8366 0 16 0C7.16344 0 0 7.16344 0 16C0 24.8366 7.16344 32 16 32Z" fill="#627EEA"/>
        <path d="M16.498 4V12.87L23.995 16.22L16.498 4Z" fill="white" fillOpacity="0.6"/>
        <path d="M16.498 4L9 16.22L16.498 12.87V4Z" fill="white"/>
        <path d="M16.498 21.968V27.995L24 17.616L16.498 21.968Z" fill="white" fillOpacity="0.6"/>
        <path d="M16.498 27.995V21.967L9 17.616L16.498 27.995Z" fill="white"/>
        <path d="M16.498 20.573L23.995 16.22L16.498 12.872V20.573Z" fill="white" fillOpacity="0.2"/>
        <path d="M9 16.22L16.498 20.573V12.872L9 16.22Z" fill="white" fillOpacity="0.6"/>
      </svg>
    ),
  },
];

const format = (value) => new Intl.NumberFormat("en-US").format(value || 0);

function applyDiscount(originalPrice, discountPercent) {
  const discount = Math.min(Math.max(Number(discountPercent || 0), 0), 100);
  return Math.round(Number(originalPrice || 0) * (1 - discount / 100));
}

function paramNumber(searchParams, key, fallback) {
  const value = Number(searchParams.get(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function customLimitsFromParams(searchParams, premiumPlusPlan) {
  const baseEmails = Number(premiumPlusPlan?.email_limit || 150000);
  const baseAdmins = Number(premiumPlusPlan?.max_admins || 5);
  const baseUsers = Number(premiumPlusPlan?.max_users || 50);
  const baseConnections = Number(premiumPlusPlan?.max_smtp_accounts || 10);
  const baseRecipients = Number(premiumPlusPlan?.max_recipients || 10000);
  return {
    email_limit: Math.max(paramNumber(searchParams, "emails", 300000), baseEmails),
    max_admins: Math.max(paramNumber(searchParams, "admins", 8), baseAdmins),
    max_users: Math.max(paramNumber(searchParams, "users", 80), baseUsers),
    max_smtp_accounts: Math.max(paramNumber(searchParams, "connections", 15), baseConnections),
    max_recipients: Math.max(paramNumber(searchParams, "recipients", 50000), baseRecipients),
  };
}

function customPreview(customPlan, premiumPlusPlan, limits) {
  const rates = {
    email_10k: Number(customPlan?.addon_prices?.email_10k || premiumPlusPlan?.addon_prices?.email_10k || 120),
    admin: Number(customPlan?.addon_prices?.admin || premiumPlusPlan?.addon_prices?.admin || 150),
    user: Number(customPlan?.addon_prices?.user || premiumPlusPlan?.addon_prices?.user || 20),
    smtp_inbox: Number(customPlan?.addon_prices?.smtp_inbox || premiumPlusPlan?.addon_prices?.smtp_inbox || 300),
    recipient_10k: Number(customPlan?.addon_prices?.recipient_10k || premiumPlusPlan?.addon_prices?.recipient_10k || 100),
  };
  const premiumWasPrice = Number(premiumPlusPlan?.original_price_bdt || 0);
  const premiumPayablePrice = Number(premiumPlusPlan?.price_bdt || premiumWasPrice || 0);
  const premiumHasDiscount = Number(premiumPlusPlan?.discount_percent || 0) > 0 && premiumWasPrice > premiumPayablePrice;
  const basePrice = premiumHasDiscount ? premiumWasPrice : premiumPayablePrice;
  const extraPrice =
    Math.max(0, Math.ceil((limits.email_limit - Number(premiumPlusPlan?.email_limit || 150000)) / 10000)) * rates.email_10k +
    Math.max(0, limits.max_admins - Number(premiumPlusPlan?.max_admins || 5)) * rates.admin +
    Math.max(0, limits.max_users - Number(premiumPlusPlan?.max_users || 50)) * rates.user +
    Math.max(0, limits.max_smtp_accounts - Number(premiumPlusPlan?.max_smtp_accounts || 10)) * rates.smtp_inbox +
    Math.max(0, Math.ceil((limits.max_recipients - Number(premiumPlusPlan?.max_recipients || 10000)) / 10000)) * rates.recipient_10k;
  const originalPrice = basePrice + extraPrice;
  const discountPercent = Number(customPlan?.discount_percent || 0);
  const payablePrice = applyDiscount(originalPrice, discountPercent);
  return {
    basePrice,
    extraPrice,
    originalPrice,
    discountPercent,
    discountAmount: Math.max(0, originalPrice - payablePrice),
    payablePrice,
  };
}

export default function Subscribe() {
  const { planSlug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [plan, setPlan] = useState(null);
  const [premiumPlusPlan, setPremiumPlusPlan] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", organization_name: "", password: "", network: "bsc" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [verificationBusy, setVerificationBusy] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [deliveryWaiting, setDeliveryWaiting] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(600);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileError, setTurnstileError] = useState(false);
  const [turnstileRenderKey, setTurnstileRenderKey] = useState(0);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [accountExistsError, setAccountExistsError] = useState(null);

  const turnstileRef = useRef(null);
  const widgetRef = useRef(null);
  const modalRef = useRef(null);
  const verificationTriggerRef = useRef(null);
  const deliveryTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const otpInputRefs = useRef([]);

  const isCustom = planSlug === "custom";
  const customLimits = customLimitsFromParams(searchParams, premiumPlusPlan);
  const preview = isCustom ? customPreview(plan, premiumPlusPlan, customLimits) : null;

  const currentPriceBdt = isCustom
    ? preview?.payablePrice || 0
    : plan?.price_bdt || plan?.original_price_bdt || 0;
  const estimatedUsdt = currentPriceBdt > 0 ? (currentPriceBdt / 119.5).toFixed(2) : "0.00";

  useEffect(() => {
    getPlans()
      .then((items) => {
        const premiumPlus = items.find((item) => item.slug === "premium-plus");
        const found = items.find((item) => item.slug === planSlug);
        if (found?.is_free) return navigate("/register", { replace: true });
        setPremiumPlusPlan(premiumPlus || null);
        setPlan(found || null);
      })
      .catch(() => setError("Unable to load this plan."));
  }, [planSlug, navigate]);

  useEffect(() => {
    if (!plan || plan.is_free || emailVerified || otpSent) return undefined;
    const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
    if (!siteKey || !turnstileRef.current) {
      if (!siteKey && plan && !plan.is_free) setTurnstileError(true);
      return undefined;
    }
    let cancelled = false;
    const render = () => {
      if (cancelled || !window.turnstile || !turnstileRef.current || widgetRef.current !== null) return;
      try {
        widgetRef.current = window.turnstile.render(turnstileRef.current, {
          sitekey: siteKey,
          action: "checkout",
          callback: (token) => {
            setTurnstileToken(token);
            setTurnstileError(false);
          },
          "expired-callback": () => setTurnstileToken(""),
          "error-callback": () => {
            setTurnstileToken("");
            setTurnstileError(true);
          },
        });
      } catch {
        setTurnstileError(true);
      }
    };
    if (window.turnstile) {
      render();
      return () => {
        cancelled = true;
      };
    }
    let script = document.querySelector('script[data-mailflow-turnstile="true"]');
    if (!script) {
      script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.dataset.mailflowTurnstile = "true";
      document.body.appendChild(script);
    }
    script.addEventListener("load", render);
    return () => {
      cancelled = true;
      script.removeEventListener("load", render);
    };
  }, [emailVerified, otpSent, plan, turnstileRenderKey]);

  useEffect(() => {
    if (!verificationOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !verificationBusy) closeVerification();
      if (event.key !== "Tab" || !modalRef.current) return;
      const controls = [
        ...modalRef.current.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ),
      ];
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => {
      modalRef.current?.focus();
      otpInputRefs.current[0]?.focus();
    });
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [verificationOpen, verificationBusy]);

  useEffect(() => {
    if (!verificationOpen) {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      return;
    }
    setCountdownSeconds(600);
    countdownTimerRef.current = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [verificationOpen]);

  useEffect(() => () => {
    if (deliveryTimerRef.current) clearTimeout(deliveryTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
  }, []);

  function resetTurnstile() {
    if (window.turnstile && widgetRef.current !== null) {
      try {
        window.turnstile.remove(widgetRef.current);
      } catch {
        /* Widget is already gone */
      }
    }
    widgetRef.current = null;
    setTurnstileToken("");
    setTurnstileError(false);
    setTurnstileRenderKey((current) => current + 1);
  }

  function resetVerificationAttempt() {
    if (deliveryTimerRef.current) clearTimeout(deliveryTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    deliveryTimerRef.current = null;
    setDeliveryWaiting(false);
    setOtpSent(false);
    setOtpDigits(["", "", "", "", "", ""]);
    setVerificationError("");
    resetTurnstile();
  }

  function closeVerification() {
    if (verificationBusy) return;
    setVerificationOpen(false);
    resetVerificationAttempt();
    requestAnimationFrame(() => verificationTriggerRef.current?.focus());
  }

  const update = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (name === "email") {
      setEmailVerified(false);
      setAccountExistsError(null);
      setError("");
      resetVerificationAttempt();
    }
  };

  const handleOtpDigitChange = (index, value) => {
    const cleaned = value.replace(/\D/g, "");
    if (!cleaned) {
      const next = [...otpDigits];
      next[index] = "";
      setOtpDigits(next);
      return;
    }
    const next = [...otpDigits];
    next[index] = cleaned[cleaned.length - 1];
    setOtpDigits(next);
    if (index < 5 && cleaned) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, event) => {
    if (event.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (event) => {
    event.preventDefault();
    const paste = (event.clipboardData || window.clipboardData)
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!paste) return;
    const next = ["", "", "", "", "", ""];
    paste.split("").forEach((char, i) => {
      if (i < 6) next[i] = char;
    });
    setOtpDigits(next);
    const focusTarget = Math.min(paste.length, 5);
    otpInputRefs.current[focusTarget]?.focus();
  };

  async function requestCode(email = form.email) {
    if (!turnstileToken) {
      setVerificationError(
        turnstileError
          ? "Checkout verification could not load. Disable content blockers, allow challenges.cloudflare.com, or try another network."
          : "Complete the checkout verification before requesting a code."
      );
      return;
    }
    setVerificationBusy("request");
    setVerificationError("");
    setAccountExistsError(null);
    setError("");
    try {
      await startCheckoutEmail(email, turnstileToken);
      setOtpSent(true);
      setVerificationOpen(true);
      setDeliveryWaiting(true);
      resetTurnstile();
      deliveryTimerRef.current = setTimeout(() => {
        setDeliveryWaiting(false);
        deliveryTimerRef.current = null;
      }, 10000);
    } catch (err) {
      const errData = err?.response?.data;
      if (errData?.code === "ACCOUNT_EXISTS") {
        setAccountExistsError({
          detail: errData.detail,
          masked_org: errData.masked_org,
          login_url: errData.login_url || `/login?email=${encodeURIComponent(email)}`,
        });
      } else {
        setError(apiError(err));
      }
      setVerificationError(apiError(err));
      resetTurnstile();
    } finally {
      setVerificationBusy("");
    }
  }

  async function verifyCode(event) {
    event.preventDefault();
    const fullOtp = otpDigits.join("");
    if (fullOtp.length !== 6) {
      setVerificationError("Please enter all 6 verification digits.");
      return;
    }
    setVerificationBusy("verify");
    setVerificationError("");
    try {
      await verifyCheckoutEmail(form.email, fullOtp);
      setEmailVerified(true);
      setVerificationOpen(false);
      resetVerificationAttempt();
      requestAnimationFrame(() => verificationTriggerRef.current?.focus());
    } catch (err) {
      setVerificationError(apiError(err));
    } finally {
      setVerificationBusy("");
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    const submitted = Object.fromEntries(new FormData(event.currentTarget).entries());
    const submittedForm = {
      ...form,
      name: String(submitted.name || ""),
      email: String(submitted.email || ""),
      organization_name: String(submitted.organization_name || ""),
      password: String(submitted.password || ""),
      network: String(submitted.network || form.network),
    };
    setForm(submittedForm);
    if (!emailVerified) {
      await requestCode(submittedForm.email);
      return;
    }
    setLoading(true);
    try {
      const invoice = isCustom
        ? await createCustomInvoice({ ...submittedForm, limits: customLimits, idempotency_key: idempotencyKey })
        : await createInvoice({ ...submittedForm, plan_slug: plan.slug, idempotency_key: idempotencyKey });
      navigate(`/payment/${invoice.id || "current"}`);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  const formatCountdown = () => {
    const mins = Math.floor(countdownSeconds / 60).toString().padStart(2, "0");
    const secs = (countdownSeconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100 px-4 py-8 lg:py-14 relative selection:bg-indigo-500 selection:text-white">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(to_right,#1e293b0c_1px,transparent_1px),linear-gradient(to_bottom,#1e293b0c_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      <div
        className="fixed inset-0 pointer-events-none opacity-40"
        style={{
          background:
            "radial-gradient(circle at 10% 20%, rgba(99,102,241,0.22), transparent 45%), radial-gradient(circle at 90% 15%, rgba(16,216,165,0.14), transparent 40%), radial-gradient(circle at 50% 85%, rgba(56,189,248,0.12), transparent 50%)",
        }}
      />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Top Breadcrumb & Status */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-indigo-300 transition group py-1.5 px-3 rounded-xl hover:bg-slate-900/60 border border-transparent hover:border-slate-800"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform text-slate-400 group-hover:text-indigo-300" />
            <span>&rarr; Back to pricing overview</span>
          </Link>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="hidden sm:inline">Independent USDT verification enabled</span>
          </div>
        </div>

        {/* 2-Column Checkout Container */}
        <div className="grid lg:grid-cols-[0.88fr_1.12fr] rounded-3xl overflow-hidden border border-white/10 bg-slate-900/70 backdrop-blur-xl shadow-2xl relative">
          
          {/* LEFT COLUMN: Plan Overview & Quotas */}
          <aside className="p-7 sm:p-9 lg:p-10 bg-gradient-to-br from-slate-950/90 via-indigo-950/40 to-slate-950 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-white/[0.08] relative overflow-hidden">
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

            <div>
              {/* Plan Header & Badges */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-600/30">
                    <Layers className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest block">
                      Selected Plan
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                      {isCustom ? "Custom Tier" : plan?.name || "Loading…"}
                    </h1>
                  </div>
                </div>

                {plan?.discount_percent > 0 && !plan.is_free && (
                  <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-lg shadow-emerald-500/20">
                    {plan.discount_percent}% OFF
                  </span>
                )}
              </div>

              {/* Pricing Summary Card */}
              {plan && (
                <div className="mt-6 p-4 rounded-2xl bg-slate-950/70 border border-white/[0.07]">
                  {isCustom && preview ? (
                    <CustomPriceSummary preview={preview} />
                  ) : (
                    <>
                      {plan.discount_percent > 0 && !plan.is_free && (
                        <div className="flex items-center gap-2 mb-1 text-xs text-slate-400">
                          <span className="line-through text-sm font-medium">
                            ৳{(plan.original_price_bdt || plan.price_bdt).toLocaleString()}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
                            Save {plan.discount_percent}%
                          </span>
                        </div>
                      )}
                      <div className="flex items-baseline gap-2">
                        <strong className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                          {plan.is_free ? "Free" : `৳${plan.price_bdt.toLocaleString()}`}
                        </strong>
                        <span className="text-xs text-slate-400 font-normal">/ 30-day cycle</span>
                      </div>
                    </>
                  )}

                  <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1 text-slate-400">
                      <Coins className="w-3.5 h-3.5 text-amber-400" /> Estimated USDT:
                    </span>
                    <span className="font-mono font-semibold text-indigo-300">~{estimatedUsdt} USDT</span>
                  </div>
                </div>
              )}

              {/* Feature Checklist */}
              {plan && (
                <div className="mt-7">
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3.5">
                    Included Allowances
                  </h2>
                  <ul className="space-y-3 text-xs sm:text-sm text-slate-200">
                    {(isCustom
                      ? [
                          `${format(customLimits.email_limit)} emails per cycle`,
                          "30-day independent quota reset",
                          `${format(customLimits.max_admins)} admins + ${format(customLimits.max_users)} users`,
                          `${format(customLimits.max_smtp_accounts)} dedicated SMTP connections`,
                          `${format(customLimits.max_recipients)} recipient contacts storage`,
                          "Lead Hunter B2B companion included",
                        ]
                      : [
                          `${plan.email_limit.toLocaleString()} emails per cycle`,
                          plan.weekly_email_limit
                            ? `${plan.weekly_email_limit.toLocaleString()} weekly cap`
                            : plan.daily_email_limit
                            ? `${plan.daily_email_limit.toLocaleString()} daily cap`
                            : "30-day independent quota reset",
                          `${plan.max_admins} admin${plan.max_admins > 1 ? "s" : ""} + ${plan.max_users} member${
                            plan.max_users > 1 ? "s" : ""
                          }`,
                          `${plan.max_smtp_accounts} dedicated SMTP connection${plan.max_smtp_accounts > 1 ? "s" : ""}`,
                          "Lead Hunter B2B companion included",
                        ]
                    ).map((item) => (
                      <li key={item} className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Instant On-Chain Activation Trust Footer */}
            <div className="mt-8 pt-6 border-t border-white/[0.08] flex items-start gap-3 text-xs text-slate-400">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="leading-relaxed">
                <strong className="text-slate-200 block">Instant On-Chain Activation</strong>
                Paid accounts activate automatically once the USDT settlement transaction is confirmed on-chain.
              </div>
            </div>
          </aside>

          {/* RIGHT COLUMN: Form & USDT Network Checkout */}
          <section className="p-7 sm:p-9 lg:p-10 flex flex-col justify-between bg-slate-900/40">
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Configure Your Workspace
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    The initial user becomes the primary organization administrator.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 text-[11px] font-semibold border border-slate-700 shrink-0">
                  Step 1 of 2
                </span>
              </div>

              {/* Account Exists Warning Box */}
              {accountExistsError && (
                <div className="mt-5 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 sm:p-5 text-sm text-amber-200 space-y-3 animate-fadeIn">
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-bold shrink-0 mt-0.5">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-amber-100 text-sm sm:text-base">Account Already Exists</h3>
                      <p className="text-xs text-amber-200/90 mt-1 leading-relaxed">
                        This email is already associated with an account connected to workspace{" "}
                        <strong className="text-white font-semibold">{accountExistsError.masked_org}</strong>.
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        To upgrade your existing workspace or manage renewals, please sign in directly.
                      </p>
                    </div>
                  </div>
                  <div className="pt-1 flex items-center gap-3 flex-wrap">
                    <Link
                      to={accountExistsError.login_url}
                      className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 shadow-lg shadow-amber-950/40 transition"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>&rarr; Sign in to your account</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => setAccountExistsError(null)}
                      className="text-xs text-slate-400 hover:text-slate-200 underline"
                    >
                      &rarr; Use a different email
                    </button>
                  </div>
                </div>
              )}

              {/* General Top Error */}
              {error && !accountExistsError && (
                <div className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs sm:text-sm text-rose-300">
                  {error}
                </div>
              )}

              <form onSubmit={submit} className="mt-6 space-y-4">
                {/* 2-Column Name & Email */}
                <div className="grid sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">Your Full Name</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        required
                        type="text"
                        name="name"
                        autoComplete="name"
                        value={form.name}
                        onChange={update}
                        placeholder="e.g. Jane Doe"
                        className="w-full rounded-xl bg-slate-950/80 border border-slate-700/80 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">Work Email</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        required
                        type="email"
                        name="email"
                        autoComplete="email"
                        value={form.email}
                        onChange={update}
                        placeholder="jane@company.com"
                        className="w-full rounded-xl bg-slate-950/80 border border-slate-700/80 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Organization & Password */}
                <div className="grid sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Organization / Workspace Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <input
                        required
                        type="text"
                        name="organization_name"
                        autoComplete="organization"
                        value={form.organization_name}
                        onChange={update}
                        placeholder="e.g. Acme Global Inc."
                        className="w-full rounded-xl bg-slate-950/80 border border-slate-700/80 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">Admin Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        required
                        type={showPassword ? "text" : "password"}
                        name="password"
                        autoComplete="new-password"
                        value={form.password}
                        onChange={update}
                        minLength={8}
                        placeholder="At least 8 characters"
                        className="w-full rounded-xl bg-slate-950/80 border border-slate-700/80 pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none transition font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* REDESIGNED CRYPTO NETWORK SELECTOR */}
                {plan && !plan.is_free && (
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold text-slate-300">
                        Select USDT Settlement Network
                      </label>
                      <span className="text-[11px] text-slate-400 font-medium">USDT Only</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {networks.map((net) => {
                        const isSelected = form.network === net.id;
                        return (
                          <label
                            key={net.id}
                            className={`relative p-3.5 rounded-2xl border cursor-pointer transition-all duration-200 ${
                              isSelected
                                ? "border-indigo-500 bg-indigo-500/10 shadow-[0_0_25px_-4px_rgba(99,102,241,0.35)]"
                                : "border-slate-700/80 bg-slate-950/50 hover:border-slate-600"
                            }`}
                          >
                            <input
                              type="radio"
                              name="network"
                              value={net.id}
                              checked={isSelected}
                              onChange={update}
                              className="sr-only"
                            />
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center shrink-0">
                                  {net.icon}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <strong className="text-xs font-bold text-white block">{net.name}</strong>
                                    <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                      {net.protocol}
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-slate-400 block mt-0.5">{net.speed}</span>
                                </div>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide shrink-0 ${
                                  net.accentColor === "emerald"
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    : net.accentColor === "indigo"
                                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                                    : net.accentColor === "cyan"
                                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                                    : "bg-slate-800 text-slate-400 border border-slate-700"
                                }`}
                              >
                                {net.badge}
                              </span>
                            </div>

                            <div className="mt-2.5 pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-400">
                              <span className="flex items-center gap-1 font-mono text-emerald-400 font-semibold">
                                <Zap className="w-3 h-3" /> {net.fee}
                              </span>
                              <span className="text-slate-400 text-[10px]">{net.speed}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Cloudflare Turnstile Verification */}
                {!emailVerified && (
                  <div className="pt-2">
                    <label className="mb-2 block text-xs font-bold text-slate-300">Checkout Verification</label>
                    <div key={turnstileRenderKey} ref={turnstileRef} />
                    {turnstileError && (
                      <p className="mt-2 text-xs text-amber-300">
                        Cloudflare verification is unavailable. Refresh after allowing challenges.cloudflare.com.
                      </p>
                    )}
                    <p className="mt-2.5 text-[11px] leading-relaxed text-slate-500">
                      After this verification check passes, clicking the button dispatches a 6-digit OTP code to your work email.
                    </p>
                  </div>
                )}

                {/* Email Verified Badge */}
                {emailVerified && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Email verified successfully. You can now generate your USDT invoice.</span>
                  </div>
                )}

                {/* Submit Action Button */}
                <button
                  ref={verificationTriggerRef}
                  disabled={!plan || loading || Boolean(verificationBusy)}
                  className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm shadow-xl active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                    emailVerified
                      ? "bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black shadow-emerald-600/30"
                      : "bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 hover:from-indigo-400 hover:to-indigo-600 text-white shadow-indigo-600/30"
                  }`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>&rarr; Generating invoice…</span>
                    </>
                  ) : verificationBusy === "request" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>&rarr; Dispatching OTP code…</span>
                    </>
                  ) : emailVerified ? (
                    <span>&rarr; Create USDT settlement invoice</span>
                  ) : (
                    <span>&rarr; Send OTP to verify email</span>
                  )}
                </button>

                {/* Security Footnote */}
                <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 pt-1">
                  <LockKeyhole className="w-3 h-3 text-slate-600" />
                  <span>Passwords are salted and securely hashed. We never request wallet private keys.</span>
                </div>
              </form>
            </div>
          </section>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* REDESIGNED 6-DIGIT EMAIL OTP VERIFICATION MODAL */}
      {/* ========================================================================= */}
      {verificationOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/85 backdrop-blur-md p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeVerification();
          }}
        >
          <section
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="email-verification-title"
            tabIndex="-1"
            className="my-8 w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 shadow-2xl outline-none overflow-hidden"
          >
            {/* Modal Header */}
            <header className="px-6 pt-6 pb-4 border-b border-white/[0.08] flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="email-verification-title" className="text-lg font-black text-white tracking-tight">
                    Verify Your Email
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Confirm workspace ownership before checkout</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeVerification}
                disabled={Boolean(verificationBusy)}
                aria-label="Close email verification"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-40"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            {/* Modal Content */}
            <div className="p-6 space-y-5">
              {/* Recipient Notice */}
              <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 text-xs text-indigo-200 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Send className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>
                    We sent a 6-digit code to <strong className="text-white font-mono">{form.email}</strong>
                  </span>
                </div>
                <p className="text-[11px] text-indigo-300/80 pl-5">
                  {deliveryWaiting ? (
                    <span className="flex items-center gap-1.5 text-amber-300">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Email is on its way (approx 5-10s).
                    </span>
                  ) : (
                    <>
                      Check your inbox and Spam/Junk folder. Code expires in{" "}
                      <span className="font-mono text-white font-bold">{formatCountdown()}</span>.
                    </>
                  )}
                </p>
              </div>

              {/* Error Box */}
              {verificationError && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300"
                >
                  {verificationError}
                </div>
              )}

              <form onSubmit={verifyCode} className="space-y-4">
                {/* 6 Individual Digit PIN Boxes */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2.5 text-center">
                    Enter 6-Digit Verification Code
                  </label>
                  <div className="flex items-center justify-center gap-2 sm:gap-2.5" onPaste={handleOtpPaste}>
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <div key={index} className="flex items-center">
                        {index === 3 && <span className="text-slate-600 font-bold text-sm px-1">-</span>}
                        <input
                          ref={(el) => (otpInputRefs.current[index] = el)}
                          type="text"
                          maxLength={1}
                          inputMode="numeric"
                          pattern="[0-9]"
                          value={otpDigits[index]}
                          onChange={(e) => handleOtpDigitChange(index, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(index, e)}
                          className="w-10 sm:w-11 h-12 sm:h-13 text-center text-xl font-bold font-mono text-white rounded-xl bg-slate-950 border border-slate-700 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/25 outline-none transition"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Modal Buttons */}
                <div className="space-y-2.5 pt-2">
                  <button
                    type="submit"
                    disabled={Boolean(verificationBusy) || otpDigits.join("").length !== 6}
                    className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs sm:text-sm shadow-lg shadow-indigo-500/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {verificationBusy === "verify" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>&rarr; Verifying code…</span>
                      </>
                    ) : (
                      <span>&rarr; Verify email and continue</span>
                    )}
                  </button>

                  <div className="flex items-center justify-between text-xs text-slate-400 px-1 pt-1">
                    <button
                      type="button"
                      onClick={() => requestCode(form.email)}
                      disabled={Boolean(verificationBusy)}
                      className="text-indigo-400 hover:text-indigo-300 font-semibold transition disabled:opacity-50"
                    >
                      &rarr; Resend Code
                    </button>
                    <button
                      type="button"
                      onClick={closeVerification}
                      disabled={Boolean(verificationBusy)}
                      className="text-slate-400 hover:text-slate-200 transition disabled:opacity-50"
                    >
                      &rarr; Edit Email Address
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function CustomPriceSummary({ preview }) {
  return (
    <div>
      {preview.discountPercent > 0 && (
        <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
          <span className="line-through text-sm font-medium">৳{format(preview.originalPrice)}</span>
          <span className="rounded-md border border-emerald-500/30 bg-emerald-950/80 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
            Save {preview.discountPercent}%
          </span>
        </div>
      )}
      <p className="text-2xl sm:text-3xl font-extrabold text-white">
        ৳{format(preview.payablePrice)}{" "}
        <span className="text-xs font-normal text-slate-400">/ 30-day cycle</span>
      </p>
      <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/60 p-3 text-xs space-y-1.5">
        <div className="flex justify-between gap-3 text-slate-300">
          <span>Premium+ Base allowance</span>
          <strong className="font-mono text-white">৳{format(preview.basePrice)}</strong>
        </div>
        <div className="flex justify-between gap-3 text-indigo-300">
          <span>Selected extra capacity</span>
          <strong className="font-mono">+৳{format(preview.extraPrice)}</strong>
        </div>
        {preview.discountPercent > 0 && (
          <div className="flex justify-between gap-3 text-emerald-300 pt-1 border-t border-white/5">
            <span>Custom volume discount</span>
            <strong className="font-mono">-৳{format(preview.discountAmount)}</strong>
          </div>
        )}
      </div>
    </div>
  );
}
