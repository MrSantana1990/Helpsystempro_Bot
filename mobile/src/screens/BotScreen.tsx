import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";
import { theme } from "../theme";
import { apiGet, apiPost } from "../lib/api";

type RiskDaily = {
  ok_to_buy: boolean;
  reason: string;
  stats: {
    buy_quote_usdt: number;
    realized_pnl_usdt: number;
    orders_count: number;
    drawdown_usdt_est: number;
  };
};

type BotStatus = { running: boolean; kill_switch?: { enabled?: boolean } };

export default function BotScreen({ baseUrl, token }: { baseUrl: string; token: string }) {
  const [risk, setRisk] = useState<RiskDaily | null>(null);
  const [bot, setBot] = useState<BotStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const refresh = async () => {
    setErr("");
    setBusy(true);
    try {
      const [r, b] = await Promise.all([
        apiGet<RiskDaily>(baseUrl, "/api/risk/daily", { token: token || undefined }),
        apiGet<BotStatus>(baseUrl, "/api/bot/status", { token: token || undefined })
      ]);
      setRisk(r);
      setBot(b);
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

  const stop = async () => {
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

  const killOn = async () => {
    setErr("");
    setBusy(true);
    try {
      await apiPost(baseUrl, "/api/kill_switch/engage", { token });
      await refresh();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const killOff = async () => {
    setErr("");
    setBusy(true);
    try {
      await apiPost(baseUrl, "/api/kill_switch/clear", { token });
      await refresh();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card title="Controle do bot">
        <View style={styles.badges}>
          <Badge text={`bot: ${bot?.running ? "LIGADO" : "DESLIGADO"}`} tone={bot?.running ? "good" : "neutral"} />
          <Badge text={`trava: ${bot?.kill_switch?.enabled ? "ATIVA" : "INATIVA"}`} tone={bot?.kill_switch?.enabled ? "bad" : "neutral"} />
          <Badge text={`ok compra: ${risk?.ok_to_buy === false ? "NÃO" : "SIM"}`} tone={risk?.ok_to_buy === false ? "warn" : "neutral"} />
        </View>
        <View style={{ height: 10 }} />
        <View style={styles.row}>
          <Button title="Atualizar" variant="secondary" onPress={() => refresh()} disabled={busy} style={{ flex: 1 }} />
          <Button title="Play (dry-run)" onPress={() => startDryRun()} disabled={busy || !token} style={{ flex: 1 }} />
        </View>
        <View style={{ height: 10 }} />
        <Button title="Parar bot" variant="danger" onPress={() => stop()} disabled={busy || !token} />
        <View style={{ height: 10 }} />
        <View style={styles.row}>
          <Button title="Ativar trava" variant="danger" onPress={() => killOn()} disabled={busy || !token} style={{ flex: 1 }} />
          <Button title="Desativar trava" variant="secondary" onPress={() => killOff()} disabled={busy || !token} style={{ flex: 1 }} />
        </View>
        {busy ? (
          <View style={{ marginTop: 10 }}>
            <ActivityIndicator />
          </View>
        ) : null}
        {err ? <Text style={[styles.p, styles.err]}>Erro: {err}</Text> : null}
        {!token ? <Text style={styles.p}>Defina um token para liberar Play/Stop e Kill switch.</Text> : null}
      </Card>

      <Card title="Risco (hoje / UTC)">
        <Text style={styles.p}>Compras: {risk?.stats ? String(risk.stats.buy_quote_usdt?.toFixed?.(2) ?? risk.stats.buy_quote_usdt) : "-"} USDT</Text>
        <Text style={styles.p}>PnL realizado: {risk?.stats ? String(risk.stats.realized_pnl_usdt?.toFixed?.(2) ?? risk.stats.realized_pnl_usdt) : "-"} USDT</Text>
        <Text style={styles.p}>Ordens: {risk?.stats ? String(risk.stats.orders_count ?? "-") : "-"}</Text>
        <Text style={styles.p}>Drawdown est.: {risk?.stats ? String(risk.stats.drawdown_usdt_est?.toFixed?.(2) ?? risk.stats.drawdown_usdt_est) : "-"} USDT</Text>
        {risk?.reason && risk.reason !== "OK" ? (
          <View style={styles.warnBox}>
            <Text style={styles.warnText}>{risk.reason}</Text>
          </View>
        ) : null}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: theme.colors.bg, gap: 14, flexGrow: 1 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  row: { flexDirection: "row", gap: 10 },
  p: { color: theme.colors.textDim, fontSize: 13, lineHeight: 18 },
  err: { color: "rgba(239,68,68,0.85)", marginTop: 10 },
  warnBox: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.30)",
    backgroundColor: "rgba(245,158,11,0.10)",
    padding: 10
  },
  warnText: { color: "rgba(255,231,176,0.9)", fontSize: 13, lineHeight: 18 }
});

