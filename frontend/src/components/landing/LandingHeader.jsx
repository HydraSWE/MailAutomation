import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CreditCard, Crosshair, HelpCircle, LogIn, Menu, ShieldCheck, Sparkles, UserPlus, X } from "lucide-react";
import BrandLogo from "../BrandLogo";

export default function LandingHeader() {
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
        : "bg-[#060911]/80 backdrop-blur-xl border-b border-white/[0.06]"
    }`}>
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link to="/" className="group" aria-label="Mail Flow home">
          <BrandLogo className="h-10 w-auto max-w-[190px] object-contain transition-transform duration-300 group-hover:scale-[1.02]" />
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-300 md:flex">
          <a href="/#features" className="flex items-center gap-1.5 transition-colors duration-200 hover:text-white">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            <span>Features</span>
          </a>
          <Link to="/lead-hunter" className="flex items-center gap-1.5 transition-colors duration-200 hover:text-white">
            <Crosshair className="h-4 w-4 text-emerald-400" />
            <span>Lead Hunter</span>
          </Link>
          <a href="/#pricing" className="flex items-center gap-1.5 transition-colors duration-200 hover:text-white">
            <CreditCard className="h-4 w-4 text-emerald-400" />
            <span>Pricing</span>
          </a>
          <a href="/#security" className="flex items-center gap-1.5 transition-colors duration-200 hover:text-white">
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
            <span>Security</span>
          </a>
          <Link to="/help" className="flex items-center gap-1.5 transition-colors duration-200 hover:text-white">
            <HelpCircle className="h-4 w-4 text-amber-400" />
            <span>Help</span>
          </Link>
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <Link
            to="/login"
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:text-white"
          >
            <LogIn className="h-4 w-4" />
            <span>Sign in</span>
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-white/10 transition-all hover:bg-slate-100 active:scale-95"
          >
            <ArrowRight className="h-4 w-4" />
            <span>Start free</span>
          </Link>
        </div>

        <button
          type="button"
          className="rounded-lg border border-white/10 bg-slate-900/50 p-2.5 text-slate-400 hover:text-white md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="flex animate-in flex-col gap-4 border-t border-white/10 bg-[#060911]/98 px-6 py-5 text-sm font-medium text-slate-200 backdrop-blur-2xl slide-in-from-top-2 md:hidden">
          <a href="/#features" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 py-1 hover:text-indigo-400">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            <span>Features</span>
          </a>
          <Link to="/lead-hunter" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 py-1 hover:text-indigo-400">
            <Crosshair className="h-4 w-4 text-emerald-400" />
            <span>Lead Hunter</span>
          </Link>
          <a href="/#pricing" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 py-1 hover:text-indigo-400">
            <CreditCard className="h-4 w-4 text-emerald-400" />
            <span>Pricing</span>
          </a>
          <a href="/#security" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 py-1 hover:text-indigo-400">
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
            <span>Security</span>
          </a>
          <Link to="/help" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 py-1 hover:text-indigo-400">
            <HelpCircle className="h-4 w-4 text-amber-400" />
            <span>Help and Support</span>
          </Link>
          <div className="flex flex-col gap-2.5 border-t border-white/10 pt-3">
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 py-2.5 font-semibold text-slate-300"
            >
              <LogIn className="h-4 w-4" />
              <span>Sign in</span>
            </Link>
            <Link
              to="/register"
              onClick={() => setMobileOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 font-bold text-white shadow-lg shadow-indigo-600/30"
            >
              <UserPlus className="h-4 w-4" />
              <span>Get Started Free</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
