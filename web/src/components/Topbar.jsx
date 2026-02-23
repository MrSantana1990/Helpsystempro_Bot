import React from "react";
import { Search, RefreshCw } from "lucide-react";
import Button from "./Button.jsx";

export default function Topbar({ onDeposit, onRefreshAll, onPlay, onStop, botOn }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl2 border border-white/10 bg-black/15 p-3 shadow-soft">
      <div className="flex min-w-0 items-center gap-3">
        <div className="h-9 w-9 rounded-xl border border-accent/30 bg-gradient-to-br from-cyan-400/20 to-purple-500/10" />
        <div className="min-w-0">
          <div className="truncate text-sm font-extrabold tracking-wide">HelpSystem</div>
          <div className="truncate text-xs text-white/70">Binance Bot • Painel React (local)</div>
        </div>
      </div>

      <div className="hidden items-center gap-2 md:flex">
        <div className="flex items-center gap-2 rounded-full border border-white/12 bg-black/20 px-3 py-2">
          <Search size={16} className="opacity-80" />
          <input className="w-72 bg-transparent text-sm outline-none placeholder:text-white/40" placeholder="Buscar..." />
        </div>
        <Button variant="primary" onClick={onDeposit}>
          Depositar
        </Button>
        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/12 bg-black/20 hover:border-white/25"
          onClick={onRefreshAll}
          title="Atualizar tudo"
        >
          <RefreshCw size={16} />
        </button>
        <Button variant="secondary" onClick={onStop} disabled={!botOn}>
          Parar
        </Button>
        <Button onClick={onPlay} disabled={botOn}>
          Play
        </Button>
      </div>
    </div>
  );
}

