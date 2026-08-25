import { Sparkles, FileArchive, Chrome, CheckCircle2, Layers, Zap, Laptop } from "lucide-react";

export const LEAD_HUNTER_LOGO_URL = "https://mail.annomous.com/lead-hunter/logo.png";
export const LEAD_HUNTER_ZIP_URL = "https://mail.annomous.com/lead-hunter/lead-hunter.zip";

export default function LeadHunterHero() {
  return (
    <section className="relative pt-16 pb-20 px-5 lg:px-8 max-w-7xl mx-auto text-center">
      
      {/* Official Lead Hunter Logo */}
      <div className="flex justify-center mb-6">
        <img
          src={LEAD_HUNTER_LOGO_URL}
          alt="Mail Flow Lead Hunter Logo"
          className="h-16 sm:h-20 w-auto object-contain drop-shadow-[0_8px_24px_rgba(99,102,241,0.35)]"
          draggable="false"
        />
      </div>

      {/* Perk Announcement Badge */}
      <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/15 to-cyan-500/15 border border-indigo-500/30 mb-6">
        <Sparkles className="w-4 h-4 text-amber-400" />
        <span className="text-xs font-bold text-indigo-200">
          Exclusive Bonus: Included at No Extra Cost with any Mail Flow Plan
        </span>
      </div>

      {/* Main Headline */}
      <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight max-w-5xl mx-auto leading-[1.1] mb-6 text-white">
        Scrape High-Intent B2B Leads <br className="hidden sm:block" />
        <span className="bg-gradient-to-r from-white via-slate-200 to-indigo-400 bg-clip-text text-transparent">
          Directly into Your Campaigns
        </span>
      </h1>

      <p className="text-base sm:text-lg text-slate-400 max-w-3xl mx-auto leading-relaxed mb-8">
        Never manually copy-paste contacts again. Extract verified local businesses, phone numbers, social profiles, and freelance clients from Google Maps, Facebook, Instagram, and Fiverr with 1-click sync into Mail Flow.
      </p>

      {/* Store Status & CTA Group */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
        <a
          href={LEAD_HUNTER_ZIP_URL}
          target="_blank"
          rel="noopener noreferrer"
          download
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 px-8 py-3.5 text-sm font-bold text-white shadow-xl shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95"
        >
          <FileArchive className="w-4 h-4" />
          <span>Download Extension (.ZIP)</span>
        </a>
        
        {/* Chrome Web Store Badge (Coming Soon) */}
        <div className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900/70 backdrop-blur-md border border-slate-700/80 text-xs font-semibold text-slate-400">
          <Chrome className="w-4 h-4 text-slate-500" />
          <span>Chrome Web Store</span>
          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider">
            Coming Soon
          </span>
        </div>
      </div>

      {/* Value Pillars */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto text-left">
        <div className="bg-slate-900/60 backdrop-blur-md p-4 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-1">
            <CheckCircle2 className="w-4 h-4" />
            <span>100% Free with Plans</span>
          </div>
          <p className="text-[11px] text-slate-400">Unlocked automatically with your active Mail Flow account email.</p>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-md p-4 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 mb-1">
            <Layers className="w-4 h-4" />
            <span>4 Scraper Channels</span>
          </div>
          <p className="text-[11px] text-slate-400">Google Maps, Facebook Pages & Groups, Instagram Bios, Fiverr Clients.</p>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-md p-4 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 mb-1">
            <Zap className="w-4 h-4" />
            <span>1-Click Direct Push</span>
          </div>
          <p className="text-[11px] text-slate-400">Pushes leads straight into Mail Flow recipient lists with zero CSV export.</p>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-md p-4 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 mb-1">
            <Laptop className="w-4 h-4" />
            <span>2 Device Policy</span>
          </div>
          <p className="text-[11px] text-slate-400">Hardware-bound cryptographic licensing with 6-digit OTP security.</p>
        </div>
      </div>
    </section>
  );
}
