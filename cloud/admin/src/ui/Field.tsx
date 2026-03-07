import type React from "react";

export default function Field({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-bold text-dim">{label}</span>
      <input
        className="rounded-xl border border-border bg-black/20 px-3 py-2 text-sm text-text outline-none focus:border-white/25"
        {...props}
      />
      {hint ? <span className="text-xs text-mute">{hint}</span> : null}
    </label>
  );
}
