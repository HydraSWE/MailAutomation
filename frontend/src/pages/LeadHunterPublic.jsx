import LeadHunterHeader from "../components/lead-hunter/LeadHunterHeader";
import LandingFooter from "../components/landing/LandingFooter";
import LeadHunterHero from "../components/lead-hunter/LeadHunterHero";
import LeadHunterInteractiveScraper from "../components/lead-hunter/LeadHunterInteractiveScraper";
import LeadHunterInstallationGuide from "../components/lead-hunter/LeadHunterInstallationGuide";
import LeadHunterChannels from "../components/lead-hunter/LeadHunterChannels";
import LeadHunterPlanQuotas from "../components/lead-hunter/LeadHunterPlanQuotas";

export default function LeadHunterPublic() {
  return (
    <div className="min-h-screen bg-[#060911] text-slate-100 selection:bg-indigo-500 selection:text-white relative overflow-x-clip font-sans">
      {/* Background Gradients & Grid Pattern */}
      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(to_right,#1e293b0a_1px,transparent_1px),linear-gradient(to_bottom,#1e293b0a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      <div
        className="fixed inset-0 pointer-events-none opacity-40"
        style={{
          background:
            "radial-gradient(circle at 15% 15%, rgba(99,102,241,0.25), transparent 40%), radial-gradient(circle at 85% 25%, rgba(56,189,248,0.18), transparent 35%), radial-gradient(circle at 50% 75%, rgba(129,140,248,0.12), transparent 50%)",
        }}
      />

      <LeadHunterHeader />

      <main className="relative z-10">
        <LeadHunterHero />
        <LeadHunterInteractiveScraper />
        <LeadHunterInstallationGuide />
        <LeadHunterChannels />
        <LeadHunterPlanQuotas />
      </main>

      <LandingFooter />
    </div>
  );
}
