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
};

type BotStatus = { running: boolean; kill_switch?: { enabled?: boolean } };

type DecisionRow = { ts_utc?: string; symbol?: string; action?: string; score?: number; confidence?: number };
type TradeRow = { ts_utc?: string; symbol?: string; side?: string; status?: string; quote_qty?: number; price?: number };

export default function DashboardScreen({ baseUrl, token }: { baseUrl: string; token: string }) {
  const [ov, setOv] = useState<Overview | null>(null);
  const [bot, setBot] = useState<BotStatus | null>(null);
  const [fx, setFx] = useState<{ price: number } | null>(null);
  const [decisions, setDecisions] = useState<DecisionRow[]>([]);
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setErr("");
    setBusy(true);
    try {
      const [o, b, fxRes, decRes, trdRes] = await Promise.all([
        apiGet<Overview>(baseUrl, "/api/overview", { token: token || undefined }),
        apiGet<BotStatus>(baseUrl, "/api/bot/status", { token: token || undefined }),
        apiGet<{ price: number }>(baseUrl, "/api/market/usdtbrl", { token: token || undefined }),
        apiGet<{ rows: DecisionRow[] }>(baseUrl, "/api/decisions", { token: token || undefined, query: { limit: 20 } }),
        apiGet<{ rows: TradeRow[] }>(baseUrl, "/api/trades", { token: token || undefined, query: { limit: 20 } })
      ]);
      setOv(o);
      setBot(b);
      setFx(fxRes);
      setDecisions(Array.isArray(decRes?.rows) ? decRes.rows : []);
      setTrades(Array.isArray(trdRes?.rows) ? trdRes.rows : []);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    refresh().catch(() => {});
  }, [baseUrl, token]);

  const statusBadges = useMemo(() => {
    const out: { text: string; tone?: "neutral" | "good" | "warn" | "bad" }[] = [];
    if (ov) out.push({ text: `ambiente: ${ov.testnet ? "TESTNET" : "REAL"}`, tone: ov.testnet ? "good" : "warn" });
    if (bot) out.push({ text: `bot: ${bot.running ? "LIGADO" : "DESLIGADO"}`, tone: bot.running ? "good" : "neutral" });
    const kill = !!bot?.kill_switch?.enabled;
    out.push({ text: `trava: ${kill ? "ATIVA" : "INATIVA"}`, tone: kill ? "bad" : "neutral" });
    return out;
  }, [ov, bot]);

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

  const fmtTs = (ts?: string) => {
    const s = String(ts || "");
    const m = s.match(/T(\d{2}:\d{2})/);
    return m ? m[1] : s ? s.slice(0, 16) : "-";
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card title="Visão geral">
        <View style={styles.badges}>
          {statusBadges.map((b) => (
            <Badge key={b.text} text={b.text} tone={b.tone} />
          ))}
        </View>
        <View style={{ height: 10 }} />
        <View style={styles.grid}>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Decisões</Text>
            <Text style={styles.kpiValue}>{ov?.counts?.decisions ?? "-"}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Trades</Text>
            <Text style={styles.kpiValue}>{ov?.counts?.trades ?? "-"}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Abertas</Text>
            <Text style={styles.kpiValue}>{ov?.counts?.open_positions ?? "-"}</Text>
          </View>
        </View>
        <View style={{ height: 10 }} />
        <Text style={styles.p}>USDT/BRL: {fx?.price ? String(fx.price) : "-"}</Text>
        <View style={{ height: 10 }} />
        <View style={styles.row}>
          <Button title="Atualizar" variant="secondary" onPress={() => refresh()} disabled={busy} style={{ flex: 1 }} />
          <Button title="Play (dry-run)" onPress={() => startDryRun()} disabled={busy || !token || !!bot?.running} style={{ flex: 1 }} />
        </View>
        <View style={{ height: 10 }} />
        <Button title="Parar bot" variant="danger" onPress={() => stopBot()} disabled={busy || !token} />
        {!!bot?.running ? <Text style={styles.p}>Observação: o bot já está ligado. Veja a aba Bot para rodar 1 ciclo agora.</Text> : null}
        {busy ? (
          <View style={{ marginTop: 10 }}>
            <ActivityIndicator />
          </View>
        ) : null}
        {err ? <Text style={[styles.p, styles.err]}>Erro: {err}</Text> : null}
        {!token ? <Text style={styles.p}>Dica: defina o token em Config para liberar Play/Stop.</Text> : null}
      </Card>

      <Card title="Atividade (últimos registros)">
        <Text style={styles.pTitle}>Decisões (até 6)</Text>
        <View style={{ gap: 8, marginTop: 8 }}>
          {decisions.slice(0, 6).map((d, idx) => (
            <View key={`${d.ts_utc || "d"}-${idx}`} style={styles.itemRow}>
              <Text style={styles.itemLeft}>{fmtTs(d.ts_utc)}</Text>
              <Text style={styles.itemMain}>{String(d.symbol || "-")}</Text>
              <Text style={styles.itemRight}>{String(d.action || "-")}</Text>
            </View>
          ))}
          {!decisions.length ? <Text style={styles.p}>Sem decisões ainda. Para gerar, rode 1 ciclo (aba Bot) ou aguarde o intervalo.</Text> : null}
        </View>

        <View style={{ height: 14 }} />
        <Text style={styles.pTitle}>Trades (até 6)</Text>
        <View style={{ gap: 8, marginTop: 8 }}>
          {trades.slice(0, 6).map((t, idx) => (
            <View key={`${t.ts_utc || "t"}-${idx}`} style={styles.itemRow}>
              <Text style={styles.itemLeft}>{fmtTs(t.ts_utc)}</Text>
              <Text style={styles.itemMain}>{String(t.symbol || "-")}</Text>
              <Text style={styles.itemRight}>{String(t.side || "-")}</Text>
            </View>
          ))}
          {!trades.length ? <Text style={styles.p}>Sem trades ainda. Em dry-run/testnet o bot só registra trade quando decide comprar/vender.</Text> : null}
        </View>
      </Card>

      <Card title="Disclaimers">
        <Text style={styles.p}>
          Não é recomendação financeira. Não há garantia de lucro. Use dry-run/testnet primeiro e aplique limites de risco.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: theme.colors.bg, gap: 14, flexGrow: 1 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  grid: { flexDirection: "row", gap: 10 },
  kpi: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, padding: 12, backgroundColor: "rgba(0,0,0,0.15)" },
  kpiLabel: { color: theme.colors.textMute, fontSize: 12, fontWeight: "800" },
  kpiValue: { color: theme.colors.text, fontSize: 20, fontWeight: "900", marginTop: 4 },
  row: { flexDirection: "row", gap: 10 },
  p: { color: theme.colors.textDim, fontSize: 13, lineHeight: 18 },
  err: { color: "rgba(239,68,68,0.85)", marginTop: 10 },
  pTitle: { color: theme.colors.text, fontSize: 13, fontWeight: "900" },
  itemRow: {
    flexDirection: "row",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(0,0,0,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  itemLeft: { color: theme.colors.textMute, width: 54, fontFamily: "monospace", fontSize: 12 },
  itemMain: { color: theme.colors.text, flex: 1, fontWeight: "900" },
  itemRight: { color: theme.colors.textDim, width: 90, textAlign: "right", fontFamily: "monospace" }
});
