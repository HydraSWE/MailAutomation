import { Download, Check } from "lucide-react";
import { LEAD_HUNTER_ZIP_URL } from "./LeadHunterHero";

export default function LeadHunterInstallationGuide() {
  return (
    <section id="installation" className="py-20 px-5 lg:px-8 max-w-5xl mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-14">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-bold mb-2">
          <Download className="w-3.5 h-3.5" />
          <span>Developer Mode Setup</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">How to Install the Extension (.ZIP)</h2>
        <p className="text-slate-400 mt-2 text-sm">
          Since the extension is currently under review for the Chrome Web Store, install it directly in Chrome in 4 quick steps.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        
        {/* STEP 1 */}
        <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md">1</div>
            <h3 className="font-bold text-white text-base">Download & Extract ZIP</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mb-4">
            Download the official Lead Hunter package file <code className="text-indigo-300 bg-indigo-950/60 px-1.5 py-0.5 rounded">lead-hunter.zip</code> and unzip it to a folder on your computer.
          </p>
          <a
            href={LEAD_HUNTER_ZIP_URL}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download lead-hunter.zip</span>
          </a>
        </div>

        {/* STEP 2 */}
        <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md">2</div>
            <h3 className="font-bold text-white text-base">Open Extensions in Chrome</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mb-4">
            In your Chrome browser, type <code className="text-cyan-300 bg-slate-900 px-1.5 py-0.5 rounded">chrome://extensions</code> in the URL bar, or click Menu &rarr; Extensions &rarr; Manage Extensions.
          </p>
          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300">
            chrome://extensions/
          </div>
        </div>

        {/* STEP 3 */}
        <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md">3</div>
            <h3 className="font-bold text-white text-base">Enable Developer Mode & Load</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Toggle on the <strong>"Developer mode"</strong> switch at the top-right corner. Then click <strong>"Load unpacked"</strong> and select your extracted <code className="text-indigo-300 bg-indigo-950/60 px-1.5 py-0.5 rounded">lead-hunter</code> folder.
          </p>
        </div>

        {/* STEP 4 */}
        <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-md">4</div>
            <h3 className="font-bold text-white text-base">Activate with Mail Flow Email</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Pin the Lead Hunter icon to your Chrome toolbar, click to open it, and type your active <strong>Mail Flow Account Email</strong>. Your recipient quota will unlock instantly!
          </p>
        </div>

      </div>
    </section>
  );
}
