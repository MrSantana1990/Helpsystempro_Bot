export default function Logo({ className }: { className?: string }) {
  return (
    <div className={className ?? ""} aria-hidden="true">
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
        <defs>
          <linearGradient id="g1" x1="3" y1="2" x2="31" y2="34" gradientUnits="userSpaceOnUse">
            <stop stopColor="rgb(240,185,11)" />
            <stop offset="1" stopColor="rgb(99,102,241)" />
          </linearGradient>
          <linearGradient id="g2" x1="0" y1="0" x2="34" y2="34" gradientUnits="userSpaceOnUse">
            <stop stopColor="rgba(255,255,255,0.85)" />
            <stop offset="1" stopColor="rgba(255,255,255,0.35)" />
          </linearGradient>
        </defs>
        <rect x="3" y="3" width="28" height="28" rx="10" fill="rgb(12,18,32)" />
        <rect x="3" y="3" width="28" height="28" rx="10" fill="url(#g1)" opacity="0.18" />
        <path
          d="M11 21.8c2.4 1.3 4.3 1.8 6 1.8 4 0 6.9-2.6 6.9-6.4 0-3.9-2.8-6.6-7.1-6.6-2.3 0-4.5.7-6.5 2.2v9Z"
          fill="url(#g2)"
          opacity="0.92"
        />
        <path
          d="M11 17.4c1.9-1.6 3.9-2.4 6.1-2.4 2.6 0 4.3 1.3 4.3 3.2 0 1.8-1.5 3-3.9 3-2 0-4.1-.7-6.5-2v-1.8Z"
          fill="rgb(240,185,11)"
          opacity="0.85"
        />
      </svg>
    </div>
  );
}

