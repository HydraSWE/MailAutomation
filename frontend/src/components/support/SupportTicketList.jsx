import { Clock, CheckCircle2, AlertCircle, Ticket, Inbox } from "lucide-react";

export default function SupportTicketList({ tickets = [], selectedTicketId, onSelectTicket }) {
  if (!tickets || tickets.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center text-slate-400">
        <Inbox className="mx-auto mb-3 h-8 w-8 text-slate-600" />
        <p className="text-sm font-semibold text-slate-300">No support tickets yet</p>
        <p className="mt-1 text-xs text-slate-500">When you submit a support request, it will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tickets.map((ticket) => {
        const isSelected = ticket.id === selectedTicketId;
        const statusConfig = getStatusBadge(ticket.status);

        return (
          <button
            key={ticket.id}
            type="button"
            onClick={() => onSelectTicket(ticket)}
            className={`w-full rounded-2xl border p-4 text-left transition-all ${
              isSelected
                ? "border-indigo-500/60 bg-slate-900 shadow-lg shadow-indigo-500/10"
                : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900"
            }`}
          >
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 font-mono font-bold text-indigo-400">
                <Ticket className="h-3.5 w-3.5" /> {ticket.ticket_number}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusConfig.className}`}>
                {statusConfig.icon}
                {statusConfig.label}
              </span>
            </div>

            <div className="truncate text-sm font-bold text-white">{ticket.subject}</div>

            {ticket.messages && ticket.messages.length > 0 && (
              <div className="mt-1 line-clamp-1 text-xs text-slate-400">
                &quot;{ticket.messages[ticket.messages.length - 1]?.body}&quot;
              </div>
            )}

            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
              <span className="capitalize">{ticket.priority || "Normal"} Priority</span>
              <span>{formatDate(ticket.last_message_at || ticket.created_at)}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function getStatusBadge(status) {
  switch (status?.toLowerCase()) {
    case "waiting":
      return {
        label: "Waiting on Customer",
        className: "bg-amber-500/10 text-amber-300 border border-amber-500/20",
        icon: <Clock className="h-3 w-3" />,
      };
    case "resolved":
      return {
        label: "Resolved",
        className: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20",
        icon: <CheckCircle2 className="h-3 w-3" />,
      };
    case "closed":
      return {
        label: "Closed",
        className: "bg-slate-800 text-slate-400 border border-slate-700",
        icon: null,
      };
    case "open":
      return {
        label: "Open",
        className: "bg-sky-500/10 text-sky-300 border border-sky-500/20",
        icon: <AlertCircle className="h-3 w-3" />,
      };
    default:
      return {
        label: "New",
        className: "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20",
        icon: <Clock className="h-3 w-3" />,
      };
  }
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return dateStr;
  }
}
