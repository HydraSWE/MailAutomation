import { Layers, MapPin, Facebook, Instagram, ShoppingBag, Check, ArrowRight } from "lucide-react";

export default function LeadHunterChannels() {
  return (
    <section id="channels" className="py-16 px-5 lg:px-8 max-w-7xl mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-14">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-bold mb-2">
          <Layers className="w-3.5 h-3.5" />
          <span>Multi-Channel Prospecting</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">4 Multi-Channel Scraping Engines</h2>
        <p className="text-slate-400 mt-2 text-sm">Target verified business owners, social media creators, and paying freelance clients.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* CARD 1: Google Maps */}
        <div className="bg-slate-900/60 backdrop-blur-md hover:bg-slate-800/80 transition-all rounded-2xl p-7 flex flex-col justify-between border border-slate-800 hover:border-indigo-500/40">
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
              <MapPin className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Google Maps B2B Local Hunter</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Extract business names, verified phone numbers, website domains, full physical addresses, and rating reviews for any city or keyword globally.
            </p>
            <div className="text-[11px] text-slate-300 space-y-1.5 font-medium">
              <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-blue-400" /> Direct phone number & coordinate scraping</div>
              <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-blue-400" /> Deep scan mode with automatic pagination</div>
            </div>
          </div>
          <div className="mt-6 pt-3 border-t border-slate-800 text-xs font-semibold text-blue-400 flex items-center gap-1.5">
            <ArrowRight className="w-3.5 h-3.5" />
            <span>Target: Agencies, Dentists, Contractors, Lawyers, Retail</span>
          </div>
        </div>

        {/* CARD 2: Facebook */}
        <div className="bg-slate-900/60 backdrop-blur-md hover:bg-slate-800/80 transition-all rounded-2xl p-7 flex flex-col justify-between border border-slate-800 hover:border-indigo-500/40">
          <div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
              <Facebook className="w-5 h-5 text-indigo-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Facebook Pages & Group Members</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Scrape public contact information from business pages and mine targeted group members participating in niche industry communities.
            </p>
            <div className="text-[11px] text-slate-300 space-y-1.5 font-medium">
              <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-indigo-400" /> Extracts page email, phone & Messenger endpoints</div>
              <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-indigo-400" /> Smooth rate limiting to keep browsing safe</div>
            </div>
          </div>
          <div className="mt-6 pt-3 border-t border-slate-800 text-xs font-semibold text-indigo-400 flex items-center gap-1.5">
            <ArrowRight className="w-3.5 h-3.5" />
            <span>Target: E-commerce founders, group leaders, local vendors</span>
          </div>
        </div>

        {/* CARD 3: Instagram */}
        <div className="bg-slate-900/60 backdrop-blur-md hover:bg-slate-800/80 transition-all rounded-2xl p-7 flex flex-col justify-between border border-slate-800 hover:border-indigo-500/40">
          <div>
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center mb-4">
              <Instagram className="w-5 h-5 text-pink-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Instagram Bio & Hashtag Hunter</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Scan profile bios for business inquiry emails, follower counts, verified checkmarks, and mine active creators posting under target hashtags.
            </p>
            <div className="text-[11px] text-slate-300 space-y-1.5 font-medium">
              <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-pink-400" /> Bio email & business phone regex extraction</div>
              <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-pink-400" /> Follower count & business category filtering</div>
            </div>
          </div>
          <div className="mt-6 pt-3 border-t border-slate-800 text-xs font-semibold text-pink-400 flex items-center gap-1.5">
            <ArrowRight className="w-3.5 h-3.5" />
            <span>Target: Influencers, DTC brands, beauty, fitness, fashion</span>
          </div>
        </div>

        {/* CARD 4: Fiverr */}
        <div className="bg-slate-900/60 backdrop-blur-md hover:bg-slate-800/80 transition-all rounded-2xl p-7 flex flex-col justify-between border border-slate-800 hover:border-indigo-500/40">
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
              <ShoppingBag className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Fiverr Client & Buyer Hunter</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Find active clients who are actively paying freelancers. Extract buyer usernames, feedback history, and country origin from competitor gig reviews.
            </p>
            <div className="text-[11px] text-slate-300 space-y-1.5 font-medium">
              <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400" /> Discovers paying buyers with verified budgets</div>
              <div className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400" /> Country origin filters (US, UK, CA, AU, EU)</div>
            </div>
          </div>
          <div className="mt-6 pt-3 border-t border-slate-800 text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
            <ArrowRight className="w-3.5 h-3.5" />
            <span>Target: High-ticket business buyers, agency contractors</span>
          </div>
        </div>

      </div>
    </section>
  );
}
