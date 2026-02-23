import React from "react";

export default function Badge({ children, tone = "neutral", className = "" }) {
  const toneCls =
    tone === "good"
      ? "border-green-500/40"
      : tone === "bad"
        ? "border-red-500/40"
        : tone === "warn"
          ? "border-yellow-500/40"
          : "border-white/15";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border ${toneCls} bg-black/20 px-3 py-1 text-xs ${className}`}>
      {children}
    </span>
  );
}

