import { CheckCircle2, ChevronRight, KeyRound, Loader2, Lock, Mail, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import CustomSelect from "../../components/common/CustomSelect";
import { useCustomActivation } from "./useCustomActivation";


const format = (v) => new Intl.NumberFormat("en-US").format(v || 0);

export default function ActivateCustomPlan() {
  const {
    step,
    loading,
    submitting,
    error,
    quoteInfo,
    otp,
    setOtp,
    pendingOrgs,
    selectedQuoteId,
    setSelectedQuoteId,
    username,
    setUsername,
    name,
    setName,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    activatedUser,
    handleRequestOtp,
    handleVerifyOtp,
    handleCompleteSetup,
    navigate,
  } = useCustomActivation();


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300 p-4">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-cyan-400 mx-auto" />
          <p className="text-sm font-medium">Validating secure activation session...</p>
        </div>
      </div>
    );
  }

  if (error && !quoteInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300 p-4">
        <div className="w-full max-w-md bg-slate-900 border border-red-500/30 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white">Activation Link Unavailable</h1>
          <p className="text-xs text-slate-400 leading-relaxed">{error}</p>
          <Link
            to="/login"
            className="inline-block mt-4 px-6 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs transition"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  const limits = quoteInfo?.approved_limits || {};

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/30 text-cyan-300 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Enterprise Workspace Setup</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Activate Your Workspace</h1>
          <p className="text-xs text-slate-400 mt-1">
            Payment verified on-chain. Follow the two-step verification to claim your enterprise workspace.
          </p>
        </div>

        <div className="bg-slate-900 border border-cyan-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-cyan-950/40 text-slate-100">
          {/* Progress Indicators */}
          <div className="flex items-center justify-between border-b border-white/10 pb-5 mb-6 text-xs font-bold text-slate-400">
            <div className={`flex items-center gap-1.5 ${step >= 1 ? "text-cyan-300" : ""}`}>
              <span className={`w-5 h-5 rounded-full grid place-items-center text-[10px] ${step >= 1 ? "bg-cyan-400 text-slate-950" : "bg-slate-800"}`}>1</span>
              <span>Identity</span>
            </div>
            <div className={`w-8 h-[1px] ${step >= 2 ? "bg-cyan-400" : "bg-slate-800"}`} />
            <div className={`flex items-center gap-1.5 ${step >= 2 ? "text-cyan-300" : ""}`}>
              <span className={`w-5 h-5 rounded-full grid place-items-center text-[10px] ${step >= 2 ? "bg-cyan-400 text-slate-950" : "bg-slate-800"}`}>2</span>
              <span>OTP</span>
            </div>
            <div className={`w-8 h-[1px] ${step >= 3 ? "bg-cyan-400" : "bg-slate-800"}`} />
            <div className={`flex items-center gap-1.5 ${step >= 3 ? "text-cyan-300" : ""}`}>
              <span className={`w-5 h-5 rounded-full grid place-items-center text-[10px] ${step >= 3 ? "bg-cyan-400 text-slate-950" : "bg-slate-800"}`}>3</span>
              <span>Password</span>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-6 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 font-medium">
              {error}
            </div>
          )}

          {/* STEP 1: Welcome & Request OTP */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/[0.08] text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Organization Name</span>
                  <strong className="text-white">{quoteInfo.organization_name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Registered Admin</span>
                  <span className="text-slate-200">{quoteInfo.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Verified Work Email</span>
                  <span className="text-cyan-300 font-mono font-bold">{quoteInfo.masked_email}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-white/[0.06]">
                  <span className="text-slate-400">Entitlements</span>
                  <span className="text-emerald-300 font-semibold">{format(limits.email_limit)} emails/mo • {limits.max_smtp_accounts} inboxes</span>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                For security, we must verify that you have access to <strong className="text-white">{quoteInfo.masked_email}</strong> before granting administrative control.
              </p>

              <button
                type="button"
                disabled={submitting}
                onClick={handleRequestOtp}
                className="w-full rounded-xl py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50 shadow-lg shadow-cyan-950/40"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                <span>Send Security Verification Code</span>
              </button>
            </div>
          )}

          {/* STEP 2: Enter 6-Digit OTP */}
          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-cyan-400/10 text-cyan-300 flex items-center justify-center mx-auto mb-2">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Enter 6-Digit Code</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Sent to <strong className="text-cyan-300">{quoteInfo.masked_email}</strong>.
                </p>
              </div>

              <div>
                <input
                  type="text"
                  maxLength={6}
                  autoFocus
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="w-full tracking-[0.5em] text-center font-mono text-2xl py-3 rounded-xl bg-slate-950/70 border border-cyan-400/40 text-cyan-200 focus:outline-none focus:border-cyan-300"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || otp.length !== 6}
                className="w-full rounded-xl py-3 px-4 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                <span>Verify Email Ownership</span>
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={submitting}
                  className="text-xs text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Resend Verification Code</span>
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Select Organization & Set Admin Password */}
          {step === 3 && (
            <form onSubmit={handleCompleteSetup} className="space-y-4">
              {pendingOrgs.length > 1 && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Select Organization to Provision</label>
                  <CustomSelect
                    value={selectedQuoteId}
                    onChange={setSelectedQuoteId}
                    options={pendingOrgs.map((org) => ({
                      value: org.quote_id,
                      label: `${org.organization_name} (Quote #${org.quote_number})`,
                    }))}
                    ariaLabel="Select Organization to Provision"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Admin Username *</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono">@</span>
                    <input
                      type="text"
                      required
                      minLength={3}
                      maxLength={150}
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ""))}
                      placeholder="admin_handle"
                      className="w-full rounded-xl bg-slate-950/70 border border-white/10 pl-8 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none font-mono"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">Used for signing into your workspace</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Admin Full Name</label>
                  <input
                    type="text"
                    maxLength={150}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your Full Name"
                    className="w-full rounded-xl bg-slate-950/70 border border-white/10 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Display name for your profile</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Create Admin Password *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters..."
                  className="w-full rounded-xl bg-slate-950/70 border border-white/10 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Confirm Admin Password *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password..."
                  className="w-full rounded-xl bg-slate-950/70 border border-white/10 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/[0.08] text-[11px] text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300">Ready to Provision:</div>
                <div>• Workspace: <strong className="text-white">{quoteInfo.organization_name}</strong></div>
                <div>• 30-Day Subscription with Enterprise Custom Plan limits</div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 rounded-xl py-3 px-4 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50 shadow-lg shadow-emerald-950/40"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>Provision Enterprise Workspace</span>
              </button>
            </form>
          )}

          {/* STEP 4: Success Screen */}
          {step === 4 && (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-white">Workspace is Live!</h2>
              <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                Your enterprise workspace for <strong className="text-white">{quoteInfo.organization_name}</strong> is fully provisioned and ready to use.
              </p>

              <div className="p-4 rounded-2xl bg-slate-950/80 border border-cyan-500/30 text-left space-y-2 max-w-md mx-auto text-xs">
                <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 mb-1">Your Admin Credentials</div>
                <div className="flex justify-between py-1 border-b border-white/[0.06]">
                  <span className="text-slate-400">Workspace</span>
                  <span className="text-white font-medium">{quoteInfo.organization_name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.06]">
                  <span className="text-slate-400">Username</span>
                  <span className="text-cyan-300 font-mono font-semibold">{activatedUser?.username || username}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.06]">
                  <span className="text-slate-400">Login Email</span>
                  <span className="text-white font-mono">{quoteInfo.masked_email}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Account Role</span>
                  <span className="text-emerald-400 font-semibold">Workspace Administrator</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="w-full mt-4 rounded-xl py-3 px-4 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs uppercase tracking-wider transition active:scale-95 shadow-lg shadow-cyan-950/40"
              >
                Launch Workspace Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
