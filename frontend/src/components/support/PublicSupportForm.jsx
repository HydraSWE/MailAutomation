import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, CheckCircle2, LifeBuoy, LogIn, Send, UserPlus } from "lucide-react";
import CustomSelect from "../common/CustomSelect";
import supportApi from "../../services/supportApi";
import { useAutoDismiss } from "../../hooks/useAutoDismiss";

const CATEGORY_OPTIONS = [
  { value: "deliverability", label: "Deliverability and SMTP" },
  { value: "billing", label: "Billing and USDT Payments" },
  { value: "custom_quote", label: "Custom Plan Quote" },
  { value: "security", label: "Account and 2FA Security" },
  { value: "api", label: "REST API and Webhooks" },
];

const PRIORITY_OPTIONS = [
  { value: "normal", label: "Normal: Standard Inquiry" },
  { value: "high", label: "High: Production Campaign Issue" },
  { value: "urgent", label: "Urgent: Outage or Payment Block" },
];

export default function PublicSupportForm({ defaultCategory = "deliverability", defaultSubject = "" }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState(defaultCategory);
  const [priority, setPriority] = useState("normal");
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState(null);
  const [error, setError] = useAutoDismiss("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileRenderKey, setTurnstileRenderKey] = useState(0);
  const turnstileRef = useRef(null);

  useEffect(() => {
    const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
    if (!siteKey || !turnstileRef.current) return undefined;

    let widgetId = null;
    let cancelled = false;

    const renderTurnstile = () => {
      if (cancelled || !window.turnstile || !turnstileRef.current) return;
      turnstileRef.current.innerHTML = "";
      widgetId = window.turnstile.render(turnstileRef.current, {
        sitekey: siteKey,
        action: "support",
        callback: (token) => setTurnstileToken(token),
        "expired-callback": () => setTurnstileToken(""),
        "error-callback": () => setTurnstileToken(""),
      });
    };

    if (window.turnstile) {
      renderTurnstile();
    } else {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      script.onload = renderTurnstile;
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      if (widgetId !== null && window.turnstile?.remove) window.turnstile.remove(widgetId);
    };
  }, [turnstileRenderKey]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const categoryLabel = CATEGORY_OPTIONS.find((c) => c.value === category)?.label || category;
    const finalSubject = subject.trim() ? `[${categoryLabel}] ${subject.trim()}` : `[${categoryLabel}] Support request`;

    try {
      const response = await supportApi.createPublicTicket({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        subject: finalSubject,
        message: message.trim(),
        priority,
        turnstile_token: turnstileToken,
      });

      setSubmittedTicket({
        ticketNumber: response.data.ticket_number || "MF-SUPPORT",
        email: email.trim(),
      });
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
      setTurnstileToken("");
      setTurnstileRenderKey((current) => current + 1);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to submit support ticket. Please try again or email support@annomous.com.");
      setTurnstileToken("");
      setTurnstileRenderKey((current) => current + 1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div id="contact" className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl backdrop-blur-xl sm:p-8 lg:p-10">
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left Information Column */}
        <div className="space-y-6 lg:col-span-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400">
            <LifeBuoy className="h-3.5 w-3.5" /> Support Ticket
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Can&apos;t find what you need? Open a support ticket.
          </h2>
          <p className="text-sm leading-relaxed text-slate-400">
            Our specialized mail infrastructure engineers will diagnose delivery drops, DNS authentication issues, custom quotes, or API questions.
          </p>

          <div className="space-y-3.5 pt-2">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400">
                <Check className="h-3.5 w-3.5" />
              </div>
              <p className="text-xs text-slate-300">
                <strong className="text-white">Email Relaying</strong>: Automated confirmation and staff replies delivered directly to your inbox.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400">
                <Check className="h-3.5 w-3.5" />
              </div>
              <p className="text-xs text-slate-300">
                <strong className="text-white">Account Tracking</strong>: Sign in or register a free account to track live tickets in your dashboard.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400">
                <Check className="h-3.5 w-3.5" />
              </div>
              <p className="text-xs text-slate-300">
                <strong className="text-white">Priority Escalation</strong> for Enterprise and Growth plan members.
              </p>
            </div>
          </div>
        </div>

        {/* Right Form Column */}
        <div className="lg:col-span-7">
          {submittedTicket ? (
            <div className="space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 sm:p-8">
              <div className="flex items-center gap-2.5 text-base font-bold text-emerald-300">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" /> Ticket {submittedTicket.ticketNumber} Created Successfully!
              </div>
              <p className="text-xs leading-relaxed text-slate-300 sm:text-sm">
                A confirmation email has been dispatched to <strong className="text-white">{submittedTicket.email}</strong>. Our staff replies will be sent directly to your inbox.
              </p>
              <div className="mt-4 border-t border-emerald-500/20 pt-4">
                <p className="text-xs text-slate-400">Want live dashboard tracking and conversation history?</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 transition-all hover:bg-indigo-500"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Create Free Account
                  </Link>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition-all hover:bg-slate-700"
                  >
                    <LogIn className="h-3.5 w-3.5" /> Sign In
                  </Link>
                  <button
                    type="button"
                    onClick={() => setSubmittedTicket(null)}
                    className="text-xs text-slate-400 underline hover:text-white"
                  >
                    Open another ticket
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-xl sm:p-7">
              {error && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                  {error}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ticket-name" className="block text-xs font-semibold text-slate-300">
                    Your Name *
                  </label>
                  <input
                    id="ticket-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Morgan"
                    className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="ticket-email" className="block text-xs font-semibold text-slate-300">
                    Work Email Address *
                  </label>
                  <input
                    id="ticket-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@company.com"
                    className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <span className="block text-xs font-semibold text-slate-300">Issue Category *</span>
                  <div className="mt-1.5">
                    <CustomSelect
                      value={category}
                      onChange={setCategory}
                      options={CATEGORY_OPTIONS}
                      ariaLabel="Select Issue Category"
                    />
                  </div>
                </div>
                <div>
                  <span className="block text-xs font-semibold text-slate-300">Priority</span>
                  <div className="mt-1.5">
                    <CustomSelect
                      value={priority}
                      onChange={setPriority}
                      options={PRIORITY_OPTIONS}
                      ariaLabel="Select Priority"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="ticket-subject" className="block text-xs font-semibold text-slate-300">
                  Subject *
                </label>
                <input
                  id="ticket-subject"
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief summary of the issue..."
                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="ticket-message" className="block text-xs font-semibold text-slate-300">
                  Message and Details *
                </label>
                <textarea
                  id="ticket-message"
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Please describe the issue in detail (include error codes, recipient domains, or transaction hash if applicable)..."
                  className="mt-1.5 w-full resize-y rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                />
              </div>

              {import.meta.env.VITE_TURNSTILE_SITE_KEY ? (
                <div key={turnstileRenderKey} ref={turnstileRef} className="min-h-[65px]" />
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition-all hover:bg-indigo-500 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                <span>{loading ? "Submitting Ticket..." : "Submit Support Ticket"}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
