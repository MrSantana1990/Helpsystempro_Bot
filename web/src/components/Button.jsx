import React from "react";

export default function Button({ variant = "ghost", className = "", ...props }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition border";
  const v =
    variant === "primary"
      ? "border-accent/60 bg-accent text-black hover:brightness-105"
      : variant === "secondary"
        ? "border-white/15 bg-white/5 hover:border-white/25"
        : "border-white/12 bg-black/20 hover:border-white/25";
  return <button className={`${base} ${v} ${className}`} {...props} />;
}

