import React from "react";
import {
  Activity,
  BarChart3,
  Bot,
  FileText,
  HeartPulse,
  LifeBuoy,
  Newspaper,
  Settings,
  ShieldCheck,
  Sparkles,
  WandSparkles
} from "lucide-react";

const groups = [
  {
    label: "Operacao",
    items: [
      { key: "overview", label: "Dashboard", icon: BarChart3 },
      { key: "bot", label: "Bot", icon: Bot },
      { key: "market", label: "Mercados", icon: Activity },
      { key: "trades", label: "Ordens/Trades", icon: FileText },
      { key: "decisions", label: "Decisoes", icon: Sparkles }
    ]
  },
  {
    label: "Inteligencia",
    items: [
      { key: "news", label: "Noticias", icon: Newspaper },
      { key: "events", label: "Eventos", icon: WandSparkles }
    ]
  },
  {
    label: "Risco",
    items: [{ key: "health", label: "Saude", icon: HeartPulse }]
  },
  {
    label: "Sistema",
    items: [
      { key: "onboarding", label: "Primeiro uso", icon: ShieldCheck },
      { key: "config", label: "Configuracoes", icon: Settings },
      { key: "support", label: "Suporte", icon: LifeBuoy }
    ]
  }
];

export default function Sidebar({ active, onSelect, botOn }) {
  return (
    <aside className="min-h-0 rounded-xl2 border border-white/10 bg-panel/80 p-3 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-bold">Navegacao</div>
        <span
          className={`rounded-full border px-2 py-1 text-xs font-mono ${
            botOn ? "border-green-500/40 text-green-200" : "border-white/15 text-white/70"
          }`}
        >
          bot: {botOn ? "ONLINE" : "PARADO"}
        </span>
      </div>
      <div className="flex max-h-[calc(100dvh-220px)] flex-col gap-3 overflow-auto pr-1">
        {groups.map((group) => (
          <div key={group.label} className="space-y-2">
            <div className="px-1 text-[11px] font-semibold uppercase tracking-wider text-white/45">{group.label}</div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = item.key === active;
              return (
                <button
                  key={item.key}
                  onClick={() => onSelect(item.key)}
                  className={[
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition",
                    isActive
                      ? "border-accent/60 bg-accent/10"
                      : "border-white/10 bg-black/10 hover:border-white/20 hover:bg-black/20"
                  ].join(" ")}
                >
                  <Icon size={18} className="opacity-90" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </aside>
  );
}
