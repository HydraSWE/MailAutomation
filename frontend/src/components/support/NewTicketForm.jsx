import { useState } from "react";
import { PlusCircle, Send } from "lucide-react";
import CustomSelect from "../common/CustomSelect";
import supportApi from "../../services/supportApi";
import { useAutoDismiss } from "../../hooks/useAutoDismiss";

const AUTH_CATEGORY_OPTIONS = [
  { value: "deliverability", label: "Deliverability and Warmup Schedule" },
  { value: "billing", label: "Billing and USDT Blockchain Invoices" },
  { value: "smtp", label: "SMTP Relay and DKIM Verification" },
  { value: "api", label: "REST API and Webhook Dispatches" },
  { value: "security", label: "Account and 2FA Administration" },
];

const AUTH_URGENCY_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "high", label: "High: Production Impact" },
  { value: "urgent", label: "Critical: Complete Sending Outage" },
];

export default function NewTicketForm({ user, onTicketCreated }) {
  const [category, setCategory] = useState("deliverability");
  const [urgency, setUrgency] = useState("normal");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useAutoDismiss("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const categoryLabel = AUTH_CATEGORY_OPTIONS.find((c) => c.value === category)?.label || category;
    const finalSubject = subject.trim() ? `[${categoryLabel}] ${subject.trim()}` : `[${categoryLabel}] Support request`;

    try {
      const response = await supportApi.createTicket({
        subject: finalSubject,
        message: message.trim(),
        priority: urgency,
      });

      setSubject("");
      setMessage("");
      if (onTicketCreated) {
        onTicketCreated(response.data);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to submit support ticket. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          <PlusCircle className="h-5 w-5 text-indigo-400" /> Create a New Support Request
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Authenticated ticket requests receive priority queueing from our technical engineering team.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="user-account" className="block text-xs font-semibold text-slate-300">
              Your Account
            </label>
            <input
              id="user-account"
              type="text"
              disabled
              value={user?.email || user?.username || "Authenticated User"}
              className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-400"
            />
          </div>
          <div>
            <label htmlFor="user-role" className="block text-xs font-semibold text-slate-300">
              Role
            </label>
            <input
              id="user-role"
              type="text"
              disabled
              value={user?.role ? `${user.role.toUpperCase()} (Priority SLA)` : "Member"}
              className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-400"
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
                options={AUTH_CATEGORY_OPTIONS}
                ariaLabel="Select Issue Category"
                size="sm"
              />
            </div>
          </div>
          <div>
            <span className="block text-xs font-semibold text-slate-300">Urgency</span>
            <div className="mt-1.5">
              <CustomSelect
                value={urgency}
                onChange={setUrgency}
                options={AUTH_URGENCY_OPTIONS}
                ariaLabel="Select Urgency"
                size="sm"
              />
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="auth-subject" className="block text-xs font-semibold text-slate-300">
            Subject *
          </label>
          <input
            id="auth-subject"
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Summary of the issue..."
            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="auth-message" className="block text-xs font-semibold text-slate-300">
            Detailed Description *
          </label>
          <textarea
            id="auth-message"
            required
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Provide full context, affected sender domain, or log extracts..."
            className="mt-1.5 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 transition-all hover:bg-indigo-500 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          <span>{loading ? "Submitting..." : "Submit Priority Ticket"}</span>
        </button>
      </form>
    </div>
  );
}
