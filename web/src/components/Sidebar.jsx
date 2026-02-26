import React from "react";
import { BarChart3, Bot, Newspaper, Settings, Activity, FileText, Sparkles, HeartPulse } from "lucide-react";

const items = [
  { key: "overview", label: "Painel de Controle", icon: BarChart3 },
  { key: "market", label: "Mercados", icon: Activity },
  { key: "trades", label: "Ordens/Trades", icon: FileText },
  { key: "decisions", label: "Decisões", icon: Sparkles },
  { key: "news", label: "Notícias", icon: Newspaper },
  { key: "bot", label: "Bot (Play)", icon: Bot },
  { key: "health", label: "Saúde", icon: HeartPulse },
  { key: "config", label: "Configurações", icon: Settings }
];

export default function Sidebar({ active, onSelect, botOn }) {
  return (
    <aside className="min-h-0 rounded-xl2 border border-white/10 bg-panel/80 p-3 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-bold">Menu</div>
        <span
          className={`rounded-full border px-2 py-1 text-xs font-mono ${botOn ? "border-green-500/40" : "border-white/15"}`}
        >
          bot: {botOn ? "LIGADO" : "DESLIGADO"}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((it) => {
          const Icon = it.icon;
          const is = it.key === active;
          return (
            <button
              key={it.key}
              onClick={() => onSelect(it.key)}
              className={[
                "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition",
                is ? "border-accent/60 bg-accent/10" : "border-white/10 bg-black/10 hover:border-white/20 hover:bg-black/20"
              ].join(" ")}
            >
              <Icon size={18} className="opacity-90" />
              <span className="truncate">{it.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
