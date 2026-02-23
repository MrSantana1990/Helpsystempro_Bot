import React from "react";

export default function MiniLine({ values }) {
  const v = (values || []).map(Number).filter((x) => Number.isFinite(x));
  if (!v.length) return <div className="h-24 rounded-xl border border-white/10 bg-black/15" />;
  const min = Math.min(...v);
  const max = Math.max(...v);
  const pad = (max - min) * 0.08 || 1;
  const lo = min - pad;
  const hi = max + pad;
  const w = 520;
  const h = 120;
  const step = w / Math.max(1, v.length - 1);
  const y = (x) => h - ((x - lo) / (hi - lo)) * h;
  const d = v.map((x, i) => `${i === 0 ? "M" : "L"} ${i * step} ${y(x)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-24 w-full rounded-xl border border-white/10 bg-black/15">
      <defs>
        <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(240,185,11,.18)" />
          <stop offset="100%" stopColor="rgba(240,185,11,0)" />
        </linearGradient>
      </defs>
      <path d={`${d} L ${w} ${h} L 0 ${h} Z`} fill="url(#fill)" />
      <path d={d} fill="none" stroke="rgba(240,185,11,.95)" strokeWidth="2.5" />
    </svg>
  );
}

