import React from "react";
import { BookOpen, CheckCircle2, ListOrdered } from "lucide-react";

interface ToolSeoContentProps {
  toolName: string;
  aboutParagraphs: string[];
  howToSteps: { title: string; detail: string }[];
  highlights: string[];
}

export default function ToolSeoContent({
  toolName,
  aboutParagraphs,
  howToSteps,
  highlights,
}: ToolSeoContentProps) {
  return (
    <section
      aria-label={`About ${toolName}`}
      className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-6 md:p-8 space-y-6 mt-8"
    >
      <div className="space-y-3">
        <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-400 shrink-0" />
          <span>About {toolName}</span>
        </h2>
        <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
          {aboutParagraphs.map((para, idx) => (
            <p key={idx}>{para}</p>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-800/80">
        <div className="space-y-3">
          <h3 className="text-sm md:text-base font-bold text-slate-100 flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>How to Use {toolName}</span>
          </h3>
          <ol className="space-y-2.5 text-xs md:text-sm text-slate-400 leading-relaxed list-decimal list-inside">
            {howToSteps.map((step, idx) => (
              <li key={idx}>
                <strong className="text-slate-200">{step.title}:</strong>{" "}
                {step.detail}
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm md:text-base font-bold text-slate-100 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Key Features &amp; Best Practices</span>
          </h3>
          <ul className="space-y-2.5 text-xs md:text-sm text-slate-400 leading-relaxed">
            {highlights.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-emerald-400 mt-1 shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
