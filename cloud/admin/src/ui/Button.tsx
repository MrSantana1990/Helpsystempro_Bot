import type React from "react";

export default function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const base = "inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-bold transition";
  const v =
    variant === "primary"
      ? "border-yellow-300/40 bg-accent text-black hover:brightness-110"
      : variant === "danger"
        ? "border-red-400/40 bg-red-500/15 text-text hover:bg-red-500/20"
        : "border-border bg-black/20 text-text hover:border-white/25";
  return (
    <button className={`${base} ${v} ${className}`} {...props}>
      {children}
    </button>
  );
}
