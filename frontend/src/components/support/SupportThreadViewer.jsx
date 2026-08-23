import { useEffect, useRef, useState } from "react";
import { Info, RefreshCw, Send, Shield, Tag, UserCheck } from "lucide-react";
import supportApi from "../../services/supportApi";

export default function SupportThreadViewer({ ticket, onTicketUpdated, onRefresh, refreshing = false }) {
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);

  const messages = ticket?.messages || [];

  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, ticket?.id]);

  if (!ticket) {
    return (
      <div className="flex h-96 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center text-slate-500">
        Select a support ticket from the list to view the full conversation.
      </div>
    );
  }

  async function handleSendReply(e) {
    e.preventDefault();
    if (!replyText.trim()) return;

    const outgoingText = replyText.trim();
    setSending(true);
    setError("");

    try {
      const response = await supportApi.reply(ticket.id, { body: outgoingText });
      setReplyText("");
      if (onTicketUpdated) {
        onTicketUpdated(response.data);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to send reply. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="border-b border-slate-800 pb-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-mono text-xs font-bold text-indigo-400">
              <Tag className="h-3.5 w-3.5" /> Ticket {ticket.ticket_number}
            </span>
            <div className="flex items-center gap-2">
              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={refreshing}
                  title="Refresh conversation thread"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-400 transition-colors hover:text-white disabled:opacity-50"
                  aria-label="Refresh thread"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-indigo-400" : ""}`} />
                </button>
              )}
              <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-xs font-semibold capitalize text-slate-300">
                {ticket.status}
              </span>
            </div>
          </div>
          <h2 className="mt-2 text-lg font-bold text-white">{ticket.subject}</h2>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
            <span>Requester: {ticket.name || ticket.email}</span>
            <span>:</span>
            <span>Priority: {ticket.priority}</span>
          </div>
        </div>

        {/* Message Thread History */}
        <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
          {messages.map((msg, idx) => {
            const isOutbound = msg.direction === "outbound";
            return (
              <div
                key={msg.id || idx}
                className={`rounded-xl p-4 text-xs leading-relaxed ${
                  isOutbound
                    ? "border border-indigo-500/30 bg-indigo-950/30 text-indigo-200"
                    : "border border-slate-800 bg-slate-950 text-slate-300"
                }`}
              >
                <div className="mb-2 flex items-center justify-between font-bold">
                  <span className={`flex items-center gap-1.5 ${isOutbound ? "text-indigo-300" : "text-slate-200"}`}>
                    {isOutbound ? (
                      <>
                        <Shield className="h-3.5 w-3.5 text-cyan-400" /> Mail Flow Support Staff
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-3.5 w-3.5 text-indigo-400" /> {msg.sender_name || "You"}
                      </>
                    )}
                  </span>
                  <span className="font-normal text-slate-500">{formatTime(msg.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap">{msg.body}</p>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Reply Box */}
      <form onSubmit={handleSendReply} className="mt-6 space-y-3 border-t border-slate-800 pt-4">
        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-300">
            {error}
          </div>
        )}
        <textarea
          rows={3}
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Write your follow-up reply to support engineering..."
          className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
        />
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-[11px] text-slate-500">
            <Info className="h-3.5 w-3.5" /> Replies update the ticket and alert the engineering team.
          </span>
          <button
            type="submit"
            disabled={sending || !replyText.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-indigo-500 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{sending ? "Sending..." : "Send Reply"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

function formatTime(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}
