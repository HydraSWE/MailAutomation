import { useState, useEffect, useRef } from "react";
import {
  PlayCircle,
  Crosshair,
  MapPin,
  Facebook,
  Instagram,
  ShoppingBag,
  Search,
  Scan,
  ShieldCheck,
  Copy,
  FileSpreadsheet,
  Send,
  Check,
  CheckCircle2,
  Loader2
} from "lucide-react";

const channelDataset = {
  maps: [
    { name: "Apex Growth Marketing", contact: "+1 (305) 892-4100", site: "apexgrowth.io", loc: "Miami, FL (4.9 Rating - 128 Reviews)", status: "Verified" },
    { name: "Quantum Legal Advisors", contact: "+1 (305) 554-9912", site: "quantumlegal.com", loc: "Brickell, FL (4.8 Rating - 84 Reviews)", status: "Verified" },
    { name: "Coral Dental Aesthetics", contact: "+1 (305) 441-2090", site: "coraldental.com", loc: "Coral Gables, FL (5.0 Rating - 310 Reviews)", status: "Verified" },
    { name: "Velocity Logistics FL", contact: "+1 (305) 778-6500", site: "velocityfl.com", loc: "Doral, FL (4.7 Rating - 56 Reviews)", status: "Verified" },
    { name: "Suncoast Real Estate Partners", contact: "+1 (305) 321-9988", site: "suncoastfl.com", loc: "Miami Beach, FL (4.9 Rating - 215 Reviews)", status: "Verified" }
  ],
  facebook: [
    { name: "Miami Real Estate Masterminds", contact: "contact@miamire.org", site: "facebook.com/groups/miamire", loc: "14,200 Group Members", status: "Active Member" },
    { name: "Florida SaaS Founders Hub", contact: "info@flfounders.co", site: "facebook.com/groups/flsaas", loc: "8,900 Group Members", status: "Active Member" },
    { name: "Boutique Fitness Studio FL", contact: "+1 (305) 901-2244", site: "facebook.com/btqfitness", loc: "Business Page (4.9 Rating)", status: "Verified Page" },
    { name: "Miami Tech Angel Network", contact: "angels@miamitech.net", site: "facebook.com/groups/miamiangels", loc: "5,400 Group Members", status: "Active Member" }
  ],
  instagram: [
    { name: "@luxurylivingmiami", contact: "inquire@luxliving.com", site: "luxlivingmiami.com", loc: "148k Followers (Verified)", status: "Bio Email" },
    { name: "@southbeachwellness", contact: "partners@sbwellness.co", site: "sbwellness.co", loc: "64k Followers", status: "Bio Email" },
    { name: "@miamitechinsider", contact: "editorial@miamitech.io", site: "miamitech.io", loc: "92k Followers", status: "Bio Email" },
    { name: "@ecomscalers_us", contact: "scale@ecomscalers.com", site: "ecomscalers.com", loc: "38k Followers", status: "Bio Email" }
  ],
  fiverr: [
    { name: "Buyer: global_media_corp", contact: "United States (Verified Client)", site: "Spent $4,200+ on Copywriting", loc: "5.0 Rating (42 orders)", status: "Active Buyer" },
    { name: "Buyer: techventures_uk", contact: "United Kingdom (Agency Client)", site: "Spent $8,500+ on Web Dev", loc: "4.9 Rating (28 orders)", status: "Active Buyer" },
    { name: "Buyer: nexus_digital_au", contact: "Australia (Ecom Store Owner)", site: "Spent $2,900+ on Ads", loc: "5.0 Rating (19 orders)", status: "Active Buyer" },
    { name: "Buyer: zenith_ventures_ca", contact: "Canada (Startup Founder)", site: "Spent $5,100+ on SEO", loc: "5.0 Rating (31 orders)", status: "Active Buyer" }
  ]
};

const defaultQueries = {
  maps: "Real Estate Agencies in Miami, FL",
  facebook: "Miami Entrepreneur & Business Group",
  instagram: "#miamirealestate #luxuryrealtor",
  fiverr: "Top Copywriting & Web Dev Gigs"
};

export default function LeadHunterInteractiveScraper() {
  const [channel, setChannel] = useState("maps");
  const [query, setQuery] = useState(defaultQueries.maps);
  const [targetLimit, setTargetLimit] = useState(25);
  const [isScraping, setIsScraping] = useState(false);
  const [extractedRows, setExtractedRows] = useState([]);
  const [statusMessage, setStatusMessage] = useState("Ready. Click Extract Leads to run live simulated scraper.");
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [pushStatus, setPushStatus] = useState("idle"); // 'idle' | 'pushing' | 'success'
  const intervalRef = useRef(null);

  function handleSelectChannel(newChannel) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsScraping(false);
    setChannel(newChannel);
    setQuery(defaultQueries[newChannel]);
    setPushStatus("idle");
    runExtraction(newChannel);
  }

  function runExtraction(chan = channel) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsScraping(true);
    setExtractedRows([]);
    setProgress(10);
    setPushStatus("idle");
    setStatusMessage(`Initializing real-time scraper on ${chan.toUpperCase()}...`);

    const dataset = channelDataset[chan] || channelDataset.maps;
    let index = 0;

    intervalRef.current = setInterval(() => {
      if (index < dataset.length) {
        const item = dataset[index];
        setExtractedRows((prev) => [...prev, item]);
        index++;
        const pct = Math.round((index / dataset.length) * 100);
        setProgress(pct);
        setStatusMessage(`Extracting record #${index} from active DOM stream...`);
      } else {
        clearInterval(intervalRef.current);
        setIsScraping(false);
        setProgress(100);
        setStatusMessage(`Extraction completed: ${dataset.length} verified leads ready.`);
      }
    }, 450);
  }

  useEffect(() => {
    runExtraction("maps");
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function handleCopy() {
    const text = extractedRows.map((r) => `${r.name} | ${r.contact} | ${r.site} | ${r.loc}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleExportCsv() {
    const rows = [
      "Business/Name,Contact,Website/Profile,Location/Metric,Status",
      ...extractedRows.map((r) => `"${r.name}","${r.contact}","${r.site}","${r.loc}","${r.status}"`),
    ];
    const blob = new Blob(["\uFEFF" + rows.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `MailFlow_LeadHunter_${channel}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handlePushToMailFlow() {
    setPushStatus("pushing");
    setTimeout(() => {
      setPushStatus("success");
    }, 700);
  }

  return (
    <section id="demo" className="py-14 px-5 lg:px-8 max-w-6xl mx-auto">
      
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-bold mb-2">
          <PlayCircle className="w-3.5 h-3.5" />
          <span>Interactive Scraper Simulator</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Test the Real-Time Lead Extraction Engine
        </h2>
        <p className="text-slate-400 mt-2 text-sm">
          Select a platform below, customize the search keywords, and watch how leads stream live into the extraction table.
        </p>
      </div>

      <div className="bg-slate-900/70 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-indigo-500/25 shadow-2xl relative overflow-hidden">
        
        {/* Subtle Glow Overlay */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Extension Window Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-800 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500/80" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
            </div>
            <div className="flex items-center gap-2 font-mono text-xs text-slate-300 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <Crosshair className="w-3.5 h-3.5 text-indigo-400" />
              <span>Mail Flow Lead Hunter: Live Scraper Session</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              License Status: Active (Pro Plan)
            </span>
          </div>
        </div>

        {/* Interactive Channel Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
          <button
            type="button"
            onClick={() => handleSelectChannel("maps")}
            className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-bold transition-all ${
              channel === "maps"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Google Maps B2B</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectChannel("facebook")}
            className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-bold transition-all ${
              channel === "facebook"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <Facebook className="w-4 h-4 text-blue-400" />
            <span>Facebook Pages/Groups</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectChannel("instagram")}
            className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-bold transition-all ${
              channel === "instagram"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <Instagram className="w-4 h-4 text-pink-400" />
            <span>Instagram Bio Hunter</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectChannel("fiverr")}
            className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs font-bold transition-all ${
              channel === "fiverr"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            <ShoppingBag className="w-4 h-4 text-emerald-400" />
            <span>Fiverr Buyer Extractor</span>
          </button>
        </div>

        {/* Live Scraper Control Box with Strict 48px Input Clearance (!pl-12) */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 mb-5 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-500">
                <Search className="w-4 h-4" />
              </div>
              <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter target search keyword or category..."
                className="w-full !pl-12 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                value={targetLimit} 
                onChange={(e) => setTargetLimit(Number(e.target.value))}
                min="5" 
                max="250" 
                title="Extraction Target Quantity"
                className="w-20 px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-center text-slate-100 focus:outline-none focus:border-indigo-500 font-bold"
              />
              <button 
                type="button"
                onClick={() => runExtraction(channel)}
                disabled={isScraping}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 transition-all active:scale-95 shrink-0"
              >
                {isScraping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
                <span>Extract Leads</span>
              </button>
              <button 
                type="button"
                onClick={() => {
                  setQuery((q) => `${q} [Deep Scan Auto-Pagination]`);
                  runExtraction(channel);
                }}
                disabled={isScraping}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-all shrink-0"
              >
                <Scan className="w-4 h-4 text-cyan-400" />
                <span>Deep Scan</span>
              </button>
            </div>
          </div>

          {/* Live Extraction Progress Bar & Status */}
          <div className="flex items-center justify-between text-[11px] pt-1">
            <span className="text-slate-400 flex items-center gap-2">
              {isScraping ? (
                <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>{statusMessage}</span>
            </span>
            <span className="font-mono text-indigo-300 font-bold">
              {extractedRows.length} leads gathered
            </span>
          </div>

          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Live Extracted Data Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80 mb-5 relative min-h-[220px]">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Business / Lead</th>
                <th className="py-3 px-4">Direct Contact</th>
                <th className="py-3 px-4">Website / Profile</th>
                <th className="py-3 px-4">Location / Metric</th>
                <th className="py-3 px-4 text-right">Mail Flow Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {extractedRows.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-900/60 transition-colors animate-in fade-in slide-in-from-top-1">
                  <td className="py-3 px-4 font-semibold text-slate-100">{item.name}</td>
                  <td className="py-3 px-4 text-emerald-400">{item.contact}</td>
                  <td className="py-3 px-4 text-indigo-300 font-sans">{item.site}</td>
                  <td className="py-3 px-4 text-slate-400 font-sans">{item.loc}</td>
                  <td className="py-3 px-4 text-right">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Check className="w-3 h-3" /> {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {extractedRows.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-xs">
              No leads extracted yet. Click <strong>Extract Leads</strong> above to stream live records.
            </div>
          )}
        </div>

        {/* Action Bar: 1-Click Push & Export */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Real-time email validation & duplicate removal active.</span>
          </div>
          
          <div className="flex items-center gap-2.5">
            <button 
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? "Copied!" : "Copy All"}</span>
            </button>
            
            <button 
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-emerald-400 border border-slate-700 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button 
              type="button"
              onClick={handlePushToMailFlow}
              disabled={pushStatus === "pushing"}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              {pushStatus === "pushing" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>{pushStatus === "pushing" ? "Pushing to Mail Flow API..." : "1-Click Push to Mail Flow"}</span>
            </button>
          </div>
        </div>

        {/* Push Notice Alert */}
        {pushStatus === "success" && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between animate-in fade-in duration-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span><strong>Success:</strong> {extractedRows.length} Leads successfully pushed to Mail Flow Audience List <em>"Miami Real Estate Leads"</em>!</span>
            </div>
            <span className="text-[10.5px] font-mono text-emerald-400/80">API 200 OK</span>
          </div>
        )}

      </div>
    </section>
  );
}
