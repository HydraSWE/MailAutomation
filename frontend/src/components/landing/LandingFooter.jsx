import { Link } from "react-router-dom";

export default function LandingFooter() {
  return (
    <footer className="relative z-10 border-t border-white/5 bg-[#060911]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-8 text-xs text-slate-500 sm:flex-row lg:px-8">
        <span>(c) 2026 Mail Flow. All rights reserved.</span>
        <Link to="/help" className="transition-colors hover:text-slate-300">
          Help and Support
        </Link>
      </div>
    </footer>
  );
}
