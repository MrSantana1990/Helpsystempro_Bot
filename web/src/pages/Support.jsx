import React, { useEffect, useMemo, useState } from "react";
import Badge from "../components/Badge.jsx";
import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";
import { apiGet, apiPost } from "../lib/api.js";

const EMPTY_FORM = {
  sector: "",
  priority: "normal",
  subject: "",
  message: "",
  name: "",
  email: "",
};

function inputClass() {
  return "mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/25";
}

export default function Support({ token }) {
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [sectors, setSectors] = useState([]);
  const [priorities, setPriorities] = useState(["normal"]);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);

  const refresh = async () => {
    setBusy(true);
    setErr("");
    try {
      const [catalog, tickets] = await Promise.all([
        apiGet("/api/support/sectors", { token }),
        apiGet("/api/support/tickets?limit=30&mine=true", { token }),
      ]);
      setSectors(Array.isArray(catalog?.rows) ? catalog.rows : []);
      setPriorities(Array.isArray(catalog?.priorities) && catalog.priorities.length ? catalog.priorities : ["normal"]);
      setRows(Array.isArray(tickets?.rows) ? tickets.rows : []);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Não foi possível carregar o suporte.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    refresh().catch(() => {});
  }, [token]);

  const canSend = useMemo(() => {
    return (
      String(form.sector || "").trim() &&
      String(form.subject || "").trim().length >= 5 &&
      String(form.message || "").trim().length >= 10
    );
  }, [form]);

  const submit = async () => {
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const payload = {
        ...form,
        channel: "web",
        platform: "portal_web",
        context: {
          screen: "support",
          path: window.location.pathname,
          userAgent: navigator.userAgent,
        },
      };
      const result = await apiPost("/api/support/tickets", { token, body: payload });
      const ticketId = String(result?.ticket?.id || "").trim();
      setMsg(ticketId ? `Chamado aberto com sucesso (${ticketId}).` : "Chamado aberto com sucesso.");
      setForm((prev) => ({ ...prev, subject: "", message: "" }));
      await refresh();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Não foi possível abrir o chamado.");
    } finally {
      setSaving(false);
    }
  };

  const toneForStatus = (status) => {
    const value = String(status || "").toLowerCase();
    if (value === "aberto") return "warn";
    if (value === "resolvido" || value === "fechado") return "good";
    return "neutral";
  };

  return (
    <div className="flex flex-col gap-3">
      {err ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">{err}</div> : null}
      {msg ? <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm">{msg}</div> : null}

      <Card
        title="Central de Suporte"
        right={
          <div className="flex items-center gap-2">
            <Badge tone="good">canal interno</Badge>
            <Button variant="secondary" onClick={() => refresh().catch(() => {})}>
              Atualizar
            </Button>
          </div>
        }
      >
        <div className="text-sm text-white/70">
          Abra chamados para erro, falha, dúvida ou melhoria. Escolha o setor correto para acelerar o atendimento.
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
          <div>
            <label className="text-xs text-white/60">Setor</label>
            <select
              className={inputClass()}
              value={form.sector}
              onChange={(e) => setForm((prev) => ({ ...prev, sector: e.target.value }))}
            >
              <option value="">Selecione um setor</option>
              {sectors.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-white/60">Prioridade</label>
            <select
              className={inputClass()}
              value={form.priority}
              onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
            >
              {priorities.map((entry) => (
                <option key={entry} value={entry}>
                  {String(entry).toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-white/60">Nome (opcional)</label>
            <input
              className={inputClass()}
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Ex.: Rodolfo Santana"
            />
          </div>
          <div>
            <label className="text-xs text-white/60">E-mail para retorno (opcional)</label>
            <input
              className={inputClass()}
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="Ex.: voce@dominio.com"
            />
          </div>
          <div className="xl:col-span-2">
            <label className="text-xs text-white/60">Assunto</label>
            <input
              className={inputClass()}
              value={form.subject}
              onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
              placeholder="Ex.: Erro ao iniciar bot com token válido"
            />
          </div>
          <div className="xl:col-span-2">
            <label className="text-xs text-white/60">Mensagem</label>
            <textarea
              className={`${inputClass()} min-h-[120px]`}
              value={form.message}
              onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
              placeholder="Descreva o cenário, o que esperava e o que aconteceu."
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={() => submit().catch(() => {})} disabled={!canSend || saving}>
            {saving ? "Enviando..." : "Abrir chamado"}
          </Button>
          <Button variant="secondary" onClick={() => setForm(EMPTY_FORM)} disabled={saving}>
            Limpar
          </Button>
        </div>
      </Card>

      <Card title="Histórico de chamados">
        {busy ? (
          <div className="text-sm text-white/60">Carregando chamados...</div>
        ) : !rows.length ? (
          <div className="text-sm text-white/60">Nenhum chamado registrado até agora.</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-white/60">
                  <th className="px-2 py-2">ID</th>
                  <th className="px-2 py-2">Setor</th>
                  <th className="px-2 py-2">Prioridade</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Assunto</th>
                  <th className="px-2 py-2">Data</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-white/5">
                    <td className="px-2 py-2 font-mono text-xs">{row.id}</td>
                    <td className="px-2 py-2">{row.sector || "-"}</td>
                    <td className="px-2 py-2">{row.priority || "-"}</td>
                    <td className="px-2 py-2">
                      <Badge tone={toneForStatus(row.status)}>{row.status || "-"}</Badge>
                    </td>
                    <td className="max-w-[360px] truncate px-2 py-2">{row.subject || "-"}</td>
                    <td className="px-2 py-2 text-xs text-white/60">{String(row.created_at || "-").replace("T", " ").slice(0, 19)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
