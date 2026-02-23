import React from "react";

export default function Card({ title, right, children, className = "" }) {
  return (
    <div className={`rounded-xl2 border border-white/10 bg-card shadow-soft ${className}`}>
      {(title || right) && (
        <div className="flex items-center justify-between gap-4 px-4 pt-4">
          <div className="text-lg font-extrabold">{title}</div>
          {right}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

