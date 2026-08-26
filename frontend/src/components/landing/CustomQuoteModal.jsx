import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, ChevronRight, KeyRound, Loader2, Mail, RefreshCw, ShieldCheck, Sparkles, X } from "lucide-react";
import { requestCustomQuoteOtp, submitCustomQuote, verifyCustomQuoteOtp } from "../../services/billingApi";
import { useAutoDismiss } from "../../hooks/useAutoDismiss";

const format = (v) => new Intl.NumberFormat("en-US").format(v || 0);

export default function CustomQuoteModal({ isOpen, onClose, limits }) {
  const [step, setStep] = useState(1); // 1: Info & OTP Request, 2: Enter OTP, 3: Success
  const [customerName, setCustomerName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [otp, setOtp] = useState("");
  const [verificationId, setVerificationId] = useState("");
  const [submittedQuote, setSubmittedQuote] = useState(null);
  const [accountExistsError, setAccountExistsError] = useAutoDismiss(null, 10000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useAutoDismiss("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileError, setTurnstileError] = useState(false);
  const [turnstileRenderKey, setTurnstileRenderKey] = useState(0);

  const turnstileRef = useRef(null);
  const widgetRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setError("");
      setAccountExistsError(null);
      setOtp("");
      setVerificationId("");
      setSubmittedQuote(null);
      return;
    }

    let cancelled = false;
    const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
    if (!siteKey || !turnstileRef.current) {
      if (!siteKey) setTurnstileError(true);
      return;
    }

    function renderWidget() {
      if (cancelled || !window.turnstile || !turnstileRef.current || widgetRef.current !== null) return;
      try {
        widgetRef.current = window.turnstile.render(turnstileRef.current, {
          sitekey: siteKey,
          theme: "dark",
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
    }

    if (window.turnstile) {
      renderWidget();
    } else {
      let script = document.querySelector('script[data-mailflow-turnstile="true"]');
      if (!script) {
        script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.dataset.mailflowTurnstile = "true";
        document.head.appendChild(script);
      }
      script.addEventListener("load", renderWidget, { once: true });
    }

    return () => {
      cancelled = true;
      if (window.turnstile && widgetRef.current !== null) {
        try {
          window.turnstile.remove(widgetRef.current);
        } catch {
          // ignore
        }
        widgetRef.current = null;
      }
    };
  }, [isOpen, step, turnstileRenderKey]);

  if (!isOpen) return null;

  async function handleSendOtp(e) {
    e?.preventDefault();
    setError("");
    setAccountExistsError(null);
    if (!customerName.trim()) return setError("Please enter your full name.");
    if (!organizationName.trim()) return setError("Please enter your organization name.");
    if (!email.trim() || !email.includes("@")) return setError("Please enter a valid work email.");

    const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
    if (siteKey && !turnstileToken) {
      return setError("Please complete the security check.");
    }

    setLoading(true);
    try {
      const res = await requestCustomQuoteOtp(email, turnstileToken);
      setVerificationId(res.verification_id);
      setStep(2);
    } catch (err) {
      const errData = err?.response?.data;
      if (errData?.code === "ACCOUNT_EXISTS") {
        setAccountExistsError({
          detail: errData.detail,
          masked_org: errData.masked_org,
          login_url: errData.login_url || `/login?email=${encodeURIComponent(email)}`,
        });
      } else {
        setError(errData?.email || errData?.detail || errData?.organization_name || "Failed to send verification code.");
      }
      setTurnstileToken("");
      setTurnstileRenderKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyAndSubmit(e) {
    e?.preventDefault();
    setError("");
    if (otp.length !== 6) return setError("Please enter the 6-digit code sent to your email.");

    setLoading(true);
    try {
      await verifyCustomQuoteOtp(verificationId, otp);
      const quoteRes = await submitCustomQuote({
        verification_id: verificationId,
        customer_name: customerName.trim(),
        organization_name: organizationName.trim(),
        notes: notes.trim(),
        requested_limits: {
          email_limit: limits?.emails || 300000,
          max_admins: limits?.admins || 8,
          max_users: limits?.users || 80,
          max_smtp_accounts: limits?.connections || 15,
          max_recipients: limits?.recipients || 50000,
          max_campaigns_per_day: 20,
        },
      });
      setSubmittedQuote(quoteRes);
      setStep(3);
    } catch (err) {
      setError(err?.response?.data?.otp || err?.response?.data?.detail || "Verification code is invalid or expired.");
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl bg-slate-900 border border-cyan-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-cyan-950/50 text-slate-100 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {step === 1 && (
          <div>
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Step 1 of 2: Enterprise Quote Request</span>
            </div>
            <h2 className="text-2xl font-black text-white mt-2">Tailored Enterprise Quote</h2>
            <p className="text-xs text-slate-400 mt-1">
              Submit your custom limits for platform approval. We'll lock your FX rate and send a 72-hour USDT invoice.
            </p>

            {/* Limits Summary Card */}
            <div className="mt-4 p-4 rounded-2xl bg-slate-950/60 border border-white/[0.08] text-xs grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-500 block">Monthly Emails</span>
                <strong className="text-cyan-300 font-bold">{format(limits?.emails || 300000)}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Admins</span>
                <strong className="text-white font-bold">{limits?.admins || 8}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Team Users</span>
                <strong className="text-white font-bold">{limits?.users || 80}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">SMTP / Inboxes</span>
                <strong className="text-cyan-300 font-bold">{limits?.connections || 15}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Recipients</span>
                <strong className="text-white font-bold">{format(limits?.recipients || 50000)}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Pricing Review</span>
                <strong className="text-emerald-400 font-bold">Custom Quote</strong>
              </div>
            </div>

            <form onSubmit={handleSendOtp} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Your Full Name *</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full rounded-xl bg-slate-950/70 border border-white/10 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Organization / Company Name *</label>
                <input
                  type="text"
                  required
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="e.g. Acme Innovations Ltd."
                  className="w-full rounded-xl bg-slate-950/70 border border-white/10 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Work Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full rounded-xl bg-slate-950/70 border border-white/10 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">We'll send a one-time verification code to this email.</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Special Requirements / Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Need dedicated sending IP or high concurrency API..."
                  className="w-full rounded-xl bg-slate-950/70 border border-white/10 px-4 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              {/* Turnstile Check */}
              <div>
                <div key={turnstileRenderKey} ref={turnstileRef} className="my-2" />
                {turnstileError && (
                  <p className="text-xs text-amber-300">Security check unavailable. Please allow challenges.cloudflare.com.</p>
                )}
              </div>

              {accountExistsError ? (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-xs text-amber-200 space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="font-bold text-amber-300">⚠️</span>
                    <div>
                      <strong className="block text-amber-100 font-bold text-sm">Account Already Exists</strong>
                      <p className="mt-1 text-amber-200/90 leading-relaxed">
                        This email is already associated with workspace <strong className="text-white">{accountExistsError.masked_org}</strong>.
                      </p>
                      <p className="mt-1 text-slate-400">
                        To request custom quotas or modify plan limits, please sign in to your dashboard.
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 flex items-center gap-3">
                    <a
                      href={accountExistsError.login_url}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 transition"
                    >
                      Sign in to workspace
                    </a>
                    <button
                      type="button"
                      onClick={() => setAccountExistsError(null)}
                      className="text-xs text-slate-400 hover:text-slate-200 underline"
                    >
                      Use another email
                    </button>
                  </div>
                </div>
              ) : error ? (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 font-medium">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 rounded-xl py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                <span>Send Verification Code</span>
              </button>
            </form>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
              <KeyRound className="w-4 h-4" />
              <span>Step 2 of 2: Verify Work Email</span>
            </div>
            <h2 className="text-2xl font-black text-white mt-2">Enter Verification Code</h2>
            <p className="text-xs text-slate-400 mt-1">
              We sent a 6-digit code to <strong className="text-cyan-300">{email}</strong>. Enter it below to submit your quote request.
            </p>

            <form onSubmit={handleVerifyAndSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">6-Digit Verification Code</label>
                <input
                  type="text"
                  maxLength={6}
                  autoFocus
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="w-full tracking-[0.5em] text-center font-mono text-xl py-3 rounded-xl bg-slate-950/70 border border-cyan-400/40 text-cyan-200 focus:outline-none focus:border-cyan-300"
                />
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 font-medium">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full rounded-xl py-3 px-4 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                <span>Verify & Submit Quote</span>
              </button>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={loading}
                  className="hover:text-white"
                >
                  ← Edit Information
                </button>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Resend Code</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 3 && (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-white">Quote Request Submitted!</h2>
            <p className="text-xs text-slate-300 mt-2 max-w-md mx-auto leading-relaxed">
              Your request for <strong className="text-white">{organizationName}</strong> has been received by our platform team.
            </p>

            <div className="mt-6 p-4 rounded-2xl bg-slate-950/60 border border-white/[0.08] text-xs text-left space-y-2">
              <div className="flex justify-between text-slate-400">
                <span>Quote Reference</span>
                <strong className="text-cyan-300 font-mono">{submittedQuote?.quote_number || "CQ-PENDING"}</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Contact Email</span>
                <span className="text-slate-200">{email}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Next Step</span>
                <span className="text-emerald-300 font-medium">Platform review & invoice email</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-xl py-3 px-4 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs uppercase tracking-wider transition"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
