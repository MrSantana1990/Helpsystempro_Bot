import React from "react";
import { CircleHelp } from "lucide-react";

export default function HelpTip({ title, text }) {
  return (
    <details className="group inline-block">
      <summary
        className="inline-flex cursor-pointer list-none items-center gap-1 rounded-full border border-white/15 bg-black/20 px-2 py-0.5 text-[11px] text-white/65 hover:border-white/25 hover:text-white"
        aria-label={`Ajuda: ${title}`}
      >
        <CircleHelp size={12} />
        ?
      </summary>
      <div className="absolute z-20 mt-2 w-[320px] max-w-[90vw] rounded-xl border border-white/15 bg-panel p-3 text-xs text-white/75 shadow-soft">
        <div className="font-bold text-white">{title}</div>
        <div className="mt-1 whitespace-pre-wrap">{text}</div>
      </div>
    </details>
  );
}
