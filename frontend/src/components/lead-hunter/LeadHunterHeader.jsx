import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  PlayCircle,
  Layers,
  Download,
  Gift,
  LogIn,
  Menu,
  X,
  FileArchive,
  ArrowRight
} from "lucide-react";
import { LEAD_HUNTER_LOGO_URL, LEAD_HUNTER_ZIP_URL } from "./LeadHunterHero";

export default function LeadHunterHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${
      scrolled 
        ? "bg-[#060911]/95 backdrop-blur-2xl border-b border-white/10 shadow-2xl shadow-black/80" 
        : "bg-[#060911]/85 backdrop-blur-xl border-b border-white/[0.06]"
    }`}>
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
        
        {/* Lead-Hunt Official Brand Header */}
        <Link to="/lead-hunter" className="flex items-center gap-3.5 group" aria-label="Lead Hunter Home">
          <img
            src={LEAD_HUNTER_LOGO_URL}
            alt="Lead Hunter Logo"
            className="h-10 w-auto object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-[0_4px_14px_rgba(99,102,241,0.35)]"
            draggable="false"
          />
          <div className="hidden sm:flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tight text-white">Lead Hunter</span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                Included Free
              </span>
            </div>
            <span className="text-[10.5px] text-slate-400 font-medium tracking-wide">
              For All Mail Flow Paid Plan Members
            </span>
          </div>
        </Link>

        {/* Lead Hunter Specific Nav Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
          <a href="#demo" className="flex items-center gap-1.5 hover:text-white transition-colors">
            <PlayCircle className="w-4 h-4 text-emerald-400" />
            <span>Live Scraper</span>
          </a>
          <a href="#channels" className="flex items-center gap-1.5 hover:text-white transition-colors">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Scraper Channels</span>
          </a>
          <a href="#installation" className="flex items-center gap-1.5 hover:text-white transition-colors">
            <Download className="w-4 h-4 text-cyan-400" />
            <span>ZIP Installation</span>
          </a>
          <a href="#plans" className="flex items-center gap-1.5 hover:text-white transition-colors">
            <Gift className="w-4 h-4 text-amber-400" />
            <span>Plan Quotas</span>
          </a>
        </nav>

        {/* Header CTAs */}
        <div className="hidden sm:flex items-center gap-3.5">
          <Link
            to="/"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>Mail Flow Main</span>
          </Link>
          <Link
            to="/login"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </Link>
          <a
            href={LEAD_HUNTER_ZIP_URL}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="inline-flex items-center gap-2 rounded-xl bg-white hover:bg-slate-100 px-4 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-white/10 transition-all hover:scale-105 active:scale-95"
          >
            <FileArchive className="w-4 h-4 text-indigo-600" />
            <span>Download ZIP</span>
          </a>
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          className="rounded-lg border border-white/10 bg-slate-900/50 p-2.5 text-slate-400 hover:text-white md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="flex animate-in flex-col gap-4 border-t border-white/10 bg-[#060911]/98 px-6 py-5 text-sm font-medium text-slate-200 backdrop-blur-2xl slide-in-from-top-2 md:hidden">
          <a
            href="#demo"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2 py-1 hover:text-indigo-400"
          >
            <PlayCircle className="w-4 h-4 text-emerald-400" />
            <span>Live Scraper Simulator</span>
          </a>
          <a
            href="#channels"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2 py-1 hover:text-indigo-400"
          >
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Scraper Channels</span>
          </a>
          <a
            href="#installation"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2 py-1 hover:text-indigo-400"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>ZIP Installation Guide</span>
          </a>
          <a
            href="#plans"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2 py-1 hover:text-indigo-400"
          >
            <Gift className="w-4 h-4 text-amber-400" />
            <span>Plan Quotas</span>
          </a>

          <div className="flex flex-col gap-2.5 border-t border-white/10 pt-3">
            <Link
              to="/"
              onClick={() => setMobileOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 py-2.5 font-semibold text-slate-300"
            >
              <ArrowRight className="w-4 h-4" />
              <span>Back to Mail Flow</span>
            </Link>
            <a
              href={LEAD_HUNTER_ZIP_URL}
              target="_blank"
              rel="noopener noreferrer"
              download
              onClick={() => setMobileOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 font-bold text-white shadow-lg shadow-indigo-600/30"
            >
              <FileArchive className="w-4 h-4" />
              <span>Download Extension (.ZIP)</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
