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

export default function DashboardScreen({ baseUrl, token }: { baseUrl: string; token: string }) {
  const [ov, setOv] = useState<Overview | null>(null);
  const [bot, setBot] = useState<BotStatus | null>(null);
  const [fx, setFx] = useState<{ price: number } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setErr("");
    setBusy(true);
    try {
      const [o, b, f] = await Promise.all([
        apiGet<Overview>(baseUrl, "/api/overview", { token: token || undefined }),
        apiGet<BotStatus>(baseUrl, "/api/bot/status", { token: token || undefined }),
        apiGet<{ price: number }>(baseUrl, "/api/market/usdtbrl", { token: token || undefined })
      ]);
      setOv(o);
      setBot(b);
      setFx(f);
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
          <Button title="Play (dry-run)" onPress={() => startDryRun()} disabled={busy || !token} style={{ flex: 1 }} />
        </View>
        <View style={{ height: 10 }} />
        <Button title="Parar bot" variant="danger" onPress={() => stopBot()} disabled={busy || !token} />
        {busy ? (
          <View style={{ marginTop: 10 }}>
            <ActivityIndicator />
          </View>
        ) : null}
        {err ? <Text style={[styles.p, styles.err]}>Erro: {err}</Text> : null}
        {!token ? <Text style={styles.p}>Dica: defina o token em Config para liberar Play/Stop.</Text> : null}
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
  err: { color: "rgba(239,68,68,0.85)", marginTop: 10 }
});

