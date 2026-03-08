import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";
import { theme } from "../theme";
import { apiGet, apiPost } from "../lib/api";

type Overview = {
  testnet: boolean;
  counts: { decisions: number; trades: number; open_positions: number };
  intelligence?: { regime?: string; position_size_multiplier?: number };
};

type BotStatus = { running: boolean; kill_switch?: { enabled?: boolean } };

type DecisionRow = {
  ts_utc?: string;
  symbol?: string;
  action?: string;
  score?: number;
  confidence?: number;
  sentiment?: number;
};

type AccountSummary = {
  enabled: boolean;
  message?: string;
  rows?: Array<{ asset?: string; free?: number; locked?: number }>;
  total_usdt?: number;
  total_brl?: number;
};

type EventsStats = {
  in_memory?: number;
  by_severity?: { info?: number; warn?: number; critical?: number };
};

export default function DashboardScreen({ baseUrl, token }: { baseUrl: string; token: string }) {
  const [ov, setOv] = useState<Overview | null>(null);
  const [bot, setBot] = useState<BotStatus | null>(null);
  const [fx, setFx] = useState<{ price: number } | null>(null);
  const [acct, setAcct] = useState<AccountSummary | null>(null);
  const [decisions, setDecisions] = useState<DecisionRow[]>([]);
  const [eventsStats, setEventsStats] = useState<EventsStats | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setErr("");
    setBusy(true);
    try {
      const [o, b, fxRes, acctRes, decRes, evRes] = await Promise.all([
        apiGet<Overview>(baseUrl, "/api/overview", { token: token || undefined }),
        apiGet<BotStatus>(baseUrl, "/api/bot/status", { token: token || undefined }),
        apiGet<{ price: number }>(baseUrl, "/api/market/usdtbrl", { token: token || undefined }),
        apiGet<AccountSummary>(baseUrl, "/api/account/summary", { token: token || undefined }).catch(() => ({ enabled: false } as any)),
        apiGet<{ rows: DecisionRow[] }>(baseUrl, "/api/decisions", { token: token || undefined, query: { limit: 6 } }),
        apiGet<EventsStats>(baseUrl, "/api/events/stats", { token: token || undefined }).catch(() => ({} as any)),
      ]);
      setOv(o);
      setBot(b);
      setFx(fxRes);
      setAcct(acctRes);
      setDecisions(Array.isArray(decRes?.rows) ? decRes.rows : []);
      setEventsStats(evRes || null);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    refresh().catch(() => {});
  }, [baseUrl, token]);

  const startDryRun = async () => {
    setErr("");
    setBusy(true);
    try {
      await apiPost(baseUrl, "/api/bot/start", { token, query: { dry_run: true, once: false } });
      await refresh();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const stopBot = async () => {
    setErr("");
    setBusy(true);
    try {
      await apiPost(baseUrl, "/api/bot/stop", { token });
      await refresh();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const score = useMemo(() => {
    const last = decisions[0] || {};
    const technical = Math.max(0, Math.min(100, ((Number(last.score || 0) + 1) / 2) * 100));
    const confidence = Math.max(0, Math.min(100, Number(last.confidence || 0) * 100));
    const sentiment = Math.max(0, Math.min(100, ((Number(last.sentiment || 0) + 1) / 2) * 100));
    return { technical, confidence, sentiment };
  }, [decisions]);

  const regime = String(ov?.intelligence?.regime || "indefinido");
  const totalUsdt = Number(acct?.total_usdt || 0);
  const totalBrl = Number(acct?.total_brl || 0);
  const kill = !!bot?.kill_switch?.enabled;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {err ? <Text style={[styles.feedback, styles.err]}>{err}</Text> : null}
      <Card title="Centro de controle" right={<Badge text={busy ? "sincronizando" : "tempo real"} tone={busy ? "warn" : "good"} />}>
        <View style={styles.statusWrap}>
          <Badge text={ov?.testnet ? "AMBIENTE TESTNET" : "AMBIENTE REAL"} tone={ov?.testnet ? "good" : "warn"} />
          <Badge text={bot?.running ? "BOT ONLINE" : "BOT PARADO"} tone={bot?.running ? "good" : "neutral"} />
          <Badge text={kill ? "TRAVA ATIVA" : "TRAVA INATIVA"} tone={kill ? "bad" : "neutral"} />
          <Badge text={`REGIME ${regime.toUpperCase()}`} />
        </View>
        <View style={{ height: 12 }} />
        <View style={styles.kpiGrid}>
          <Kpi title="Saldo estimado" value={totalUsdt > 0 ? `${totalUsdt.toFixed(4)} USDT` : "-"} sub={totalBrl > 0 ? `≈ R$ ${totalBrl.toFixed(2)}` : "Sem Binance API"} />
          <Kpi title="Decisões" value={String(ov?.counts?.decisions ?? "-")} sub="motor analítico" />
          <Kpi title="Trades" value={String(ov?.counts?.trades ?? "-")} sub="execuções registradas" />
          <Kpi title="Abertas" value={String(ov?.counts?.open_positions ?? "-")} sub="posições em curso" />
        </View>
        <View style={{ height: 10 }} />
        <View style={styles.actions}>
          <Button title="Atualizar" variant="secondary" onPress={() => refresh()} disabled={busy} style={{ flex: 1 }} />
          <Button title="Play (dry-run)" onPress={() => startDryRun()} disabled={busy || !!bot?.running || !token} style={{ flex: 1 }} />
          <Button title="Parar bot" variant="danger" onPress={() => stopBot()} disabled={busy || !token} style={{ flex: 1 }} />
        </View>
      </Card>

      <Card title="Inteligência do sistema">
        <ScoreBar label="Score técnico" value={score.technical} color={theme.colors.cyan} />
        <ScoreBar label="Confiança do modelo" value={score.confidence} color={theme.colors.accent} />
        <ScoreBar label="Sentimento de mercado" value={score.sentiment} color={theme.colors.purple} />
        <View style={{ height: 8 }} />
        <Text style={styles.copy}>
          Eventos em memória: {Number(eventsStats?.in_memory || 0)} • críticos: {Number(eventsStats?.by_severity?.critical || 0)} • taxa USDT/BRL:{" "}
          {Number(fx?.price || 0) > 0 ? Number(fx?.price || 0).toFixed(4) : "-"}
        </Text>
      </Card>

      <Card title="Decisões recentes">
        {!decisions.length ? (
          <Text style={styles.copy}>Sem decisões registradas ainda.</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {decisions.map((d, idx) => (
              <View key={`${d.ts_utc || "d"}-${idx}`} style={styles.row}>
                <Text style={styles.rowTime}>{String(d.ts_utc || "").slice(11, 19) || "-"}</Text>
                <Text style={styles.rowMain}>{d.symbol || "-"}</Text>
                <Text style={styles.rowAction}>{String(d.action || "-").toUpperCase()}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card title="Disclaimers">
        <Text style={styles.copy}>
          Não é recomendação financeira. Não há garantia de lucro. Use dry-run/testnet e limites de risco antes de operar em ambiente real.
        </Text>
      </Card>

      {busy ? (
        <View style={styles.loading}>
          <ActivityIndicator />
        </View>
      ) : null}
    </ScrollView>
  );
}

function Kpi({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiTitle}>{title}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiSub}>{sub}</Text>
    </View>
  );
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  const width = `${Math.max(2, Math.min(100, value))}%` as any;
  return (
    <View style={{ gap: 5, marginBottom: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={styles.scoreLabel}>{label}</Text>
        <Text style={styles.scoreValue}>{value.toFixed(0)}%</Text>
      </View>
      <View style={styles.scoreTrack}>
        <View style={[styles.scoreFill, { width, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: theme.colors.bg, gap: 14, flexGrow: 1 },
  feedback: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontWeight: "700" },
  err: { color: "#fecaca", backgroundColor: "rgba(127,29,29,0.35)", borderColor: "rgba(248,113,113,0.5)" },
  statusWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiCard: {
    minWidth: "47%",
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    backgroundColor: "rgba(2,6,23,0.65)",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  kpiTitle: { color: theme.colors.textMute, fontSize: 12, fontWeight: "700" },
  kpiValue: { color: theme.colors.text, fontSize: 20, fontWeight: "900", marginTop: 4 },
  kpiSub: { color: theme.colors.textDim, fontSize: 12, marginTop: 3 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  copy: { color: theme.colors.textDim, fontSize: 13, lineHeight: 19 },
  scoreLabel: { color: theme.colors.textDim, fontWeight: "700", fontSize: 12 },
  scoreValue: { color: theme.colors.text, fontWeight: "900", fontSize: 12 },
  scoreTrack: { height: 9, borderRadius: 999, backgroundColor: "rgba(148,163,184,0.18)", overflow: "hidden" },
  scoreFill: { height: "100%", borderRadius: 999 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    backgroundColor: "rgba(2,6,23,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  rowTime: { color: theme.colors.textMute, fontFamily: "monospace", width: 64, fontSize: 12 },
  rowMain: { color: theme.colors.text, fontWeight: "900", flex: 1, fontSize: 13 },
  rowAction: { color: theme.colors.accent, fontWeight: "900", fontSize: 12 },
  loading: { paddingBottom: 18 },
});
