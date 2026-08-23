import { useState } from "react";
import { ArrowRight, ChevronDown, HelpCircle } from "lucide-react";
import { FAQS_DATA } from "./faqsData";

export default function HelpFaqAccordion({ activeCategory = "All", searchQuery = "", onSelectTicketCta }) {
  const [openIds, setOpenIds] = useState(() => new Set(["faq-1"]));

  const toggleFaq = (id) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredFaqs = FAQS_DATA.filter((faq) => {
    const matchCategory = activeCategory === "All" || faq.category === activeCategory;
    const query = searchQuery.toLowerCase().trim();
    const matchQuery =
      !query ||
      faq.question.toLowerCase().includes(query) ||
      faq.answer.toLowerCase().includes(query) ||
      faq.category.toLowerCase().includes(query);
    return matchCategory && matchQuery;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-100">
            <HelpCircle className="h-5 w-5 text-indigo-400" /> Frequently Asked Questions
          </h2>
          <p className="mt-1 text-xs text-slate-400">Curated answers to common deliverability and setup inquiries.</p>
        </div>
        <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 font-mono text-xs text-indigo-400">
          {filteredFaqs.length} {filteredFaqs.length === 1 ? "guide" : "guides"}
        </span>
      </div>

      {filteredFaqs.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
          No guides found matching &quot;<span className="text-white">{searchQuery}</span>&quot;.
          <div className="mt-3">
            <button
              type="button"
              onClick={onSelectTicketCta}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
            >
              <ArrowRight className="h-4 w-4" /> Submit a ticket to our engineering team
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFaqs.map((faq) => {
            const isOpen = openIds.has(faq.id);
            return (
              <div key={faq.id} className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/70 transition-all">
                <button
                  type="button"
                  onClick={() => toggleFaq(faq.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-slate-800/40"
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 font-mono text-xs font-bold text-indigo-400">
                      {faq.category}
                    </span>
                    <span className="text-sm font-semibold text-slate-100 sm:text-base">{faq.question}</span>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {isOpen && (
                  <div className="border-t border-slate-800/50 px-5 pb-5 pt-2 text-xs leading-relaxed text-slate-400 sm:text-sm">
                    <p>{faq.answer}</p>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-800/40 pt-3 font-mono text-xs text-slate-500">
                      <span>Tag: {faq.badge}</span>
                      <span>{faq.readTime}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
