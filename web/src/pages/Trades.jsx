import React, { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import Badge from "../components/Badge.jsx";
import { apiGet } from "../lib/api.js";
import { fmtNumber, fmtPrice } from "../lib/format.js";

export default function Trades({ token }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  const refresh = async () => {
    setErr("");
    const r = await apiGet("/api/trades?limit=200", { token });
    setRows(r.rows || []);
  };

  useEffect(() => {
    refresh().catch((e) => setErr(e.message));
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {err ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">{err}</div> : null}
      <Card
        title="Ordens / Trades"
        right={
          <div className="flex items-center gap-2">
            <Badge>itens: {rows.length}</Badge>
            <Button variant="secondary" onClick={() => refresh().catch((e) => setErr(e.message))}>
              Atualizar
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-2">
          {rows.map((t) => (
            <div key={t.id} className="grid grid-cols-[1.2fr_.7fr_.9fr_.9fr] gap-3 rounded-xl border border-white/10 bg-black/10 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate font-extrabold">{t.symbol}</div>
                <div className="text-xs text-white/60">{String(t.ts_utc || "").slice(0, 19)}</div>
              </div>
              <div className="text-right font-mono text-sm">{t.side}</div>
              <div className="text-right font-mono text-sm">{fmtNumber(t.qty, 6)}</div>
              <div className="text-right font-mono text-sm">{fmtPrice(t.price)}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
