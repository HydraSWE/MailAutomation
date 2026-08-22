import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Copy, Download, Loader2, RefreshCcw, ShieldCheck, ShieldOff, X } from "lucide-react";

export default function TwoFactorDialogs({ showSetup2FA, setup2FAData, setShowSetup2FA, setup2FAStep, setSetup2FAStep, setup2FACode, setSetup2FACode, onConfirm2FA, setup2FALoading, setup2FABackupCodes, copyBackupCodes, downloadBackupCodes, toast, showDisable2FA, setShowDisable2FA, disable2FAPassword, setDisable2FAPassword, onDisable2FA, twoFALoading, showRegenCodes, setShowRegenCodes, regenCodes, regenPassword, setRegenPassword, onRegenBackupCodes }) {
  return <>
      {/* 2FA Setup Modal (Accessible from any tab) */}
      {showSetup2FA && setup2FAData && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 relative">
            <button onClick={() => setShowSetup2FA(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              {setup2FAStep === 1 ? "Scan QR Code" : setup2FAStep === 2 ? "Verify Code" : "Save Backup Codes"}
            </h3>

            {setup2FAStep === 1 && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Scan this QR code with your authenticator app (Google Authenticator, 1Password, Authy, etc.).</p>
                <div className="flex justify-center">
                  <img src={setup2FAData.qr_code} alt="2FA QR Code" className="rounded-xl border border-slate-700" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Manual Entry Key</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono break-all">{setup2FAData.secret}</code>
                    <button onClick={() => { navigator.clipboard.writeText(setup2FAData.secret); toast.success("Secret copied!"); }} className="p-2 text-slate-400 hover:text-indigo-400 bg-slate-800 rounded-lg"><Copy className="w-4 h-4" /></button>
                  </div>
                </div>
                <button
                  onClick={() => setSetup2FAStep(2)}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all"
                >
                  &rarr; I&apos;ve scanned the code - Next
                </button>
              </div>
            )}

            {setup2FAStep === 2 && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Enter the 6-digit code shown in your authenticator app to verify setup.</p>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Verification Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={setup2FACode}
                    onChange={(e) => setSetup2FACode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    autoFocus
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-center text-xl tracking-[0.4em] font-mono text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setSetup2FAStep(1)} className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-sm font-medium">Back</button>
                  <button
                    onClick={onConfirm2FA}
                    disabled={setup2FALoading || setup2FACode.length !== 6}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {setup2FALoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Verify & Activate
                  </button>
                </div>
              </div>
            )}

            {setup2FAStep === 3 && (
              <div className="space-y-4">
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Save these backup codes in a secure location. Each code can only be used once. You won&apos;t be able to see them again.</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {setup2FABackupCodes.map((code, i) => (
                    <div key={i} className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-center font-mono text-sm text-slate-200 tracking-widest">
                      {code}
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => copyBackupCodes(setup2FABackupCodes)} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold"><Copy className="w-3.5 h-3.5" />Copy All</button>
                  <button onClick={() => downloadBackupCodes(setup2FABackupCodes)} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold"><Download className="w-3.5 h-3.5" />Download</button>
                </div>
                <button
                  onClick={() => setShowSetup2FA(false)}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all"
                >
                  &rarr; I&apos;ve saved my codes - Done
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Disable 2FA Modal (Accessible from any tab) */}
      {showDisable2FA && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 relative">
            <button onClick={() => setShowDisable2FA(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2"><ShieldOff className="w-5 h-5 text-rose-400" />Disable Two-Factor Authentication</h3>
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>This will remove the extra security layer from your account. You can re-enable it at any time.</span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm Password</label>
              <input
                type="password"
                value={disable2FAPassword}
                onChange={(e) => setDisable2FAPassword(e.target.value)}
                autoFocus
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowDisable2FA(false)} className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm font-medium">Cancel</button>
              <button
                onClick={onDisable2FA}
                disabled={twoFALoading || !disable2FAPassword}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {twoFALoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />}
                Disable 2FA
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Regenerate Backup Codes Modal (Accessible from any tab) */}
      {showRegenCodes && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 relative">
            <button onClick={() => setShowRegenCodes(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2"><RefreshCcw className="w-5 h-5 text-indigo-400" />Regenerate Backup Codes</h3>

            {regenCodes.length === 0 ? (
              <div className="space-y-4">
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>This will invalidate all existing backup codes and generate new ones.</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={regenPassword}
                    onChange={(e) => setRegenPassword(e.target.value)}
                    autoFocus
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowRegenCodes(false)} className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm font-medium">Cancel</button>
                  <button
                    onClick={onRegenBackupCodes}
                    disabled={twoFALoading || !regenPassword}
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {twoFALoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                    Generate New Codes
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Save these new backup codes. Previous codes are now invalid.</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {regenCodes.map((code, i) => (
                    <div key={i} className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-center font-mono text-sm text-slate-200 tracking-widest">
                      {code}
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => copyBackupCodes(regenCodes)} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold"><Copy className="w-3.5 h-3.5" />Copy All</button>
                  <button onClick={() => downloadBackupCodes(regenCodes)} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold"><Download className="w-3.5 h-3.5" />Download</button>
                </div>
                <button
                  onClick={() => setShowRegenCodes(false)}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
  </>;
}

