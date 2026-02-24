import React, { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import Badge from "../components/Badge.jsx";
import { apiGet } from "../lib/api.js";
import { fmtNumber } from "../lib/format.js";

export default function News({ token }) {
  const [term, setTerm] = useState("crypto");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const refresh = async () => {
    setErr("");
    const r = await apiGet("/api/news?term=" + encodeURIComponent(term) + "&limit=18", { token });
    setData(r);
  };

  useEffect(() => {
    refresh().catch((e) => setErr(e.message));
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {err ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">{err}</div> : null}
      <Card
        title="Notícias (simplificadas)"
        right={
          <div className="flex items-center gap-2">
            <Badge>sent. médio: {data?.enabled ? fmtNumber(data.avg_sentiment ?? 0, 3) : "-"}</Badge>
            <Button variant="secondary" onClick={() => refresh().catch((e) => setErr(e.message))}>
              Atualizar
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="text-xs text-white/60">Tema</div>
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm outline-none focus:border-white/25"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>
          <Button onClick={() => refresh().catch((e) => setErr(e.message))}>Buscar</Button>
        </div>

        <div className="mt-3">
          {!data ? (
            <div className="text-sm text-white/60">Carregando...</div>
          ) : !data.enabled ? (
            <div className="rounded-xl border border-yellow-500/25 bg-yellow-500/10 p-3 text-sm">{data.message}</div>
          ) : (
            <div className="flex flex-col gap-2">
              {(data.rows || []).map((a, idx) => (
                <a
                  key={idx}
                  href={a.url || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-white/10 bg-black/10 p-3 hover:border-white/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-extrabold">{a.title || "(sem título)"}</div>
                      <div className="mt-1 text-xs text-white/60">{a.source || ""}</div>
                    </div>
                    <span
                      className={[
                        "rounded-full border px-3 py-1 text-xs",
                        a.class === "positivo"
                          ? "border-green-500/40"
                          : a.class === "negativo"
                            ? "border-red-500/40"
                            : "border-white/15"
                      ].join(" ")}
                    >
                      {a.class}
                    </span>
                  </div>
                  {a.description ? <div className="mt-2 text-sm text-white/70">{a.description}</div> : null}
                </a>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
