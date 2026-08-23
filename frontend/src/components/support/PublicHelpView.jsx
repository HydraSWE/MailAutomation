import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Globe,
  HelpCircle,
  LogIn,
  Mail,
  Rocket,
  Search,
  Send,
  Server,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import BrandLogo from "../BrandLogo";
import { CATEGORIES_DATA } from "./faqsData";
import HelpFaqAccordion from "./HelpFaqAccordion";
import PublicSupportForm from "./PublicSupportForm";

const ICON_MAP = {
  Sparkles,
  Rocket,
  CreditCard,
  Server,
  TrendingUp,
  ShieldCheck,
};

export default function PublicHelpView() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedEmail, setCopiedEmail] = useState(false);

  function copySupportEmail() {
    navigator.clipboard.writeText("support@annomous.com");
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 3000);
  }

  function handleQuickFilter(category) {
    setActiveCategory(category);
    const element = document.getElementById("kb-section");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  }

  function scrollToContact() {
    const element = document.getElementById("contact");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  }

  return (
    <div className="min-h-screen bg-[#060911] text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Toast Notification */}
      {copiedEmail && (
        <div className="fixed bottom-6 right-6 z-50 flex max-w-md items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold text-white">Email Copied</div>
            <div className="mt-0.5 text-xs text-slate-400">support@annomous.com copied to clipboard.</div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#060911]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link to="/" className="group flex items-center gap-3" aria-label="Mail Flow home">
            <BrandLogo className="h-10 w-auto max-w-[190px] object-contain transition-transform duration-300 group-hover:scale-[1.02]" />
            <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-400">
              Support
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-300 md:flex">
            <a href="#kb-section" className="flex items-center gap-1.5 transition-colors hover:text-white">
              <Globe className="h-4 w-4 text-indigo-400" /> Knowledge Base
            </a>
            <button type="button" onClick={scrollToContact} className="flex items-center gap-1.5 transition-colors hover:text-white">
              <HelpCircle className="h-4 w-4 text-cyan-400" /> Submit Ticket
            </button>
            <a href="#status" className="flex items-center gap-1.5 transition-colors hover:text-white">
              <Activity className="h-4 w-4 text-emerald-400" /> System Status
            </a>
          </nav>

          <div className="flex items-center gap-4">
            <Link to="/login" className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-300 transition-colors hover:text-white">
              <LogIn className="h-4 w-4" /> Sign in
            </Link>
            <button
              type="button"
              onClick={scrollToContact}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:bg-indigo-500 active:scale-95"
            >
              <HelpCircle className="h-4 w-4" /> Get Help
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section with Search */}
      <section className="relative overflow-hidden px-5 pb-16 pt-14 lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(99,102,241,0.25),rgba(255,255,255,0))]"></div>

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400"></span>
            <ShieldCheck className="h-3.5 w-3.5" /> Support Desk: 24/7 Priority SLA
          </div>

          <h1 className="mb-6 text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            How can we help you <span className="bg-gradient-to-r from-indigo-400 via-sky-300 to-cyan-300 bg-clip-text text-transparent">today?</span>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-base text-slate-400 sm:text-lg">
            Search our deliverability knowledge base, explore setup guides, or open a direct ticket with our infrastructure engineering team.
          </p>

          {/* Search Bar */}
          <div className="relative mx-auto max-w-2xl">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
              <Search className="h-5 w-5" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search guides, SMTP configuration, USDT payments, DNS records..."
              className="w-full rounded-2xl border border-slate-700 bg-slate-900/90 py-4 !pl-12 !pr-12 text-sm text-white placeholder-slate-500 shadow-2xl outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 sm:text-base"
              style={{ paddingLeft: "3.25rem", paddingRight: "3rem" }}
            />
          </div>

          {/* Quick Filter Chips */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="mr-1 text-xs font-semibold uppercase text-slate-500">Popular:</span>
            <button
              type="button"
              onClick={() => handleQuickFilter("Getting Started")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-300 transition-all hover:border-slate-700 hover:text-white"
            >
              <Globe className="h-3.5 w-3.5 text-indigo-400" /> Domain Setup
            </button>
            <button
              type="button"
              onClick={() => handleQuickFilter("Billing & USDT")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-300 transition-all hover:border-slate-700 hover:text-white"
            >
              <CreditCard className="h-3.5 w-3.5 text-emerald-400" /> USDT Payment
            </button>
            <button
              type="button"
              onClick={() => handleQuickFilter("SMTP & Relays")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-300 transition-all hover:border-slate-700 hover:text-white"
            >
              <Server className="h-3.5 w-3.5 text-cyan-400" /> Port 587/465
            </button>
            <button
              type="button"
              onClick={() => handleQuickFilter("Deliverability")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-300 transition-all hover:border-slate-700 hover:text-white"
            >
              <TrendingUp className="h-3.5 w-3.5 text-amber-400" /> IP Warmup
            </button>
          </div>
        </div>
      </section>

      {/* Category Filter Cards */}
      <section className="mx-auto max-w-7xl px-5 py-4 lg:px-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES_DATA.map((cat) => {
            const Icon = ICON_MAP[cat.icon] || Sparkles;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`group rounded-2xl border p-4 text-left transition-all ${
                  isActive
                    ? "border-indigo-500/60 bg-indigo-950/20 shadow-lg shadow-indigo-500/10"
                    : "border-slate-800 bg-slate-900/60 hover:border-indigo-500/40 hover:bg-slate-900"
                }`}
              >
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 transition-transform group-hover:scale-110">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="text-sm font-bold text-white group-hover:text-indigo-300">{cat.label}</div>
                <div className="mt-1 text-xs text-slate-400">{cat.sub}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Knowledge Base Section & Right Channels */}
      <section id="kb-section" className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:grid-cols-12 lg:px-8">
        <div className="lg:col-span-8">
          <HelpFaqAccordion
            activeCategory={activeCategory}
            searchQuery={searchQuery}
            onSelectTicketCta={scrollToContact}
          />
        </div>

        {/* Right Channels */}
        <div className="space-y-6 lg:col-span-4">
          <div id="status" className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-6 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                <span className="h-2.5 w-2.5 animate-ping rounded-full bg-emerald-400"></span>
                System Status
              </span>
              <span className="font-mono text-xs text-emerald-300">99.98% Uptime</span>
            </div>
            <h3 className="flex items-center gap-2 text-base font-bold text-white">
              <Activity className="h-4 w-4 text-emerald-400" /> All Systems Operational
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              SMTP Relays, Webhook Dispatches, and Tron USDT listeners running normally.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/15 text-indigo-400">
              <Mail className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">Direct Email Support</h3>
            <p className="mb-4 mt-1 text-xs text-slate-400">You can email our dedicated engineering queue directly:</p>
            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-sm text-slate-200">
              <span>support@annomous.com</span>
              <button
                type="button"
                onClick={copySupportEmail}
                className="inline-flex items-center gap-1 rounded bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-400 transition-colors hover:text-indigo-300"
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Target Response:
              </span>
              <span className="font-semibold text-slate-300">&lt; 2 Hours</span>
            </div>
          </div>
        </div>
      </section>

      {/* Ticket Form Section */}
      <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <PublicSupportForm />
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/5 bg-[#060911]/90 px-5 py-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-xs text-slate-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-400">Mail Flow</span>: Enterprise Email Automation and Support Studio
          </div>
          <div>(c) 2026 Mail Flow. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
