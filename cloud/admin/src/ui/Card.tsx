import type React from "react";

export default function Card({
  title,
  right,
  children
}: {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      {title || right ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-lg font-extrabold">{title}</div>
          {right}
        </div>
      ) : null}
      {children}
    </div>
  );
}
