import { useEffect, useState } from "react";
import { BookOpen, Inbox, LifeBuoy, Plus, PlusCircle, RefreshCw } from "lucide-react";
import supportApi from "../../services/supportApi";
import SupportTicketList from "./SupportTicketList";
import SupportThreadViewer from "./SupportThreadViewer";
import NewTicketForm from "./NewTicketForm";
import SupportDocumentation from "./SupportDocumentation";

export default function AuthenticatedSupportHub({ user }) {
  const [activeTab, setActiveTab] = useState("tickets");
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadTickets(isManualRefresh = false) {
    if (isManualRefresh) setRefreshing(true);
    try {
      const response = await supportApi.getTickets();
      const list = response.data.results || response.data || [];
      setTickets(list);
      if (list.length > 0) {
        setSelectedTicket((prev) => {
          if (!prev) return list[0];
          const updated = list.find((t) => t.id === prev.id);
          return updated || list[0];
        });
      }
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
      if (isManualRefresh) setRefreshing(false);
    }
  }

  // Initial load
  useEffect(() => {
    loadTickets();
  }, []);

  // Smart 15-second background polling for live incoming replies
  useEffect(() => {
    if (activeTab !== "tickets") return;

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadTickets();
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [activeTab]);

  function handleTicketCreated(newTicket) {
    loadTickets();
    setSelectedTicket(newTicket);
    setActiveTab("tickets");
  }

  function handleTicketUpdated(updatedTicket) {
    setSelectedTicket(updatedTicket);
    setTickets((prev) => prev.map((t) => (t.id === updatedTicket.id ? updatedTicket : t)));
  }

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold text-white">
            <LifeBuoy className="h-6 w-6 text-indigo-400" /> Help and Support Workspace
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Manage support tickets, track active deliverability consultations, and contact priority engineering support.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => loadTickets(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-700 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-indigo-400" : ""}`} />
            <span>{refreshing ? "Refreshing..." : "Sync"}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("new-ticket")}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-500"
          >
            <PlusCircle className="h-4 w-4" />
            <span>New Support Request</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-slate-800 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("tickets")}
          className={`flex items-center gap-2 pb-3 transition-colors ${
            activeTab === "tickets"
              ? "border-b-2 border-indigo-500 text-indigo-400"
              : "border-b-2 border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Inbox className="h-4 w-4" /> My Support Tickets ({tickets.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("new-ticket")}
          className={`flex items-center gap-2 pb-3 transition-colors ${
            activeTab === "new-ticket"
              ? "border-b-2 border-indigo-500 text-indigo-400"
              : "border-b-2 border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Plus className="h-4 w-4" /> Submit New Ticket
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("docs")}
          className={`flex items-center gap-2 pb-3 transition-colors ${
            activeTab === "docs"
              ? "border-b-2 border-indigo-500 text-indigo-400"
              : "border-b-2 border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <BookOpen className="h-4 w-4" /> Documentation and Guides
        </button>
      </div>

      {/* Tab 1: Tickets List & Thread View */}
      {activeTab === "tickets" && (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5">
            {loading ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-xs text-slate-400">
                Loading support tickets...
              </div>
            ) : (
              <SupportTicketList
                tickets={tickets}
                selectedTicketId={selectedTicket?.id}
                onSelectTicket={setSelectedTicket}
              />
            )}
          </div>

          <div className="lg:col-span-7">
            <SupportThreadViewer
              ticket={selectedTicket}
              onTicketUpdated={handleTicketUpdated}
              onRefresh={() => loadTickets(true)}
              refreshing={refreshing}
            />
          </div>
        </div>
      )}

      {/* Tab 2: New Ticket Form */}
      {activeTab === "new-ticket" && (
        <NewTicketForm user={user} onTicketCreated={handleTicketCreated} />
      )}

      {/* Tab 3: Documentation */}
      {activeTab === "docs" && <SupportDocumentation />}
    </div>
  );
}
