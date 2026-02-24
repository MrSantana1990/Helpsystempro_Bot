export default function ThemeToggle({
  theme,
  onToggle
}: {
  theme: "dark" | "light";
  onToggle: () => void;
}) {
  const label = theme === "dark" ? "Alternar para tema claro" : "Alternar para tema escuro";
  return (
    <button
      type="button"
      className="focus-ring inline-flex items-center justify-center rounded-xl border border-border/10 bg-card/60 px-3 py-2 text-sm text-text shadow-soft backdrop-blur hover:bg-card/80"
      onClick={onToggle}
      aria-label={label}
      title={label}
    >
      {theme === "dark" ? <span aria-hidden="true">☾</span> : <span aria-hidden="true">☀</span>}
      <span className="sr-only">{label}</span>
    </button>
  );
}

