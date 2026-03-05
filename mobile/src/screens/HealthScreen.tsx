import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";
import { theme } from "../theme";
import { apiGet } from "../lib/api";

type OpsHealth = {
  api: { uptime_s: number };
  bot: { running: boolean; kill_switch?: { enabled?: boolean } };
  runtime: { last_cycle_start_utc?: string; last_cycle_end_utc?: string; last_error_at_utc?: string; last_error?: string };
  license?: { valid?: boolean; status?: string; plan?: string; expires_at_utc?: string; reason?: string };
};

export default function HealthScreen({ baseUrl, token }: { baseUrl: string; token: string }) {
  const [data, setData] = useState<OpsHealth | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const refresh = async () => {
    setErr("");
    setBusy(true);
    try {
      const r = await apiGet<OpsHealth>(baseUrl, "/api/ops/health", { token: token || undefined });
      setData(r);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    refresh().catch(() => {});
  }, [baseUrl, token]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card title="Saúde do sistema">
        <View style={styles.badges}>
          <Badge text={`tempo ligado: ${data?.api?.uptime_s ?? "-"}s`} />
          <Badge text={`bot: ${data?.bot?.running ? "LIGADO" : "DESLIGADO"}`} tone={data?.bot?.running ? "good" : "neutral"} />
          <Badge text={`trava: ${data?.bot?.kill_switch?.enabled ? "ATIVA" : "INATIVA"}`} tone={data?.bot?.kill_switch?.enabled ? "bad" : "neutral"} />
        </View>
        <View style={{ height: 10 }} />
        <Button title="Atualizar" variant="secondary" onPress={() => refresh()} disabled={busy} />
        {busy ? (
          <View style={{ marginTop: 10 }}>
            <ActivityIndicator />
          </View>
        ) : null}
        {err ? <Text style={[styles.p, styles.err]}>Erro: {err}</Text> : null}
      </Card>

      <Card title="Operação (runtime)">
        <Text style={styles.p}>início último ciclo (UTC): {data?.runtime?.last_cycle_start_utc || "-"}</Text>
        <Text style={styles.p}>fim último ciclo (UTC): {data?.runtime?.last_cycle_end_utc || "-"}</Text>
        <Text style={styles.p}>último erro (UTC): {data?.runtime?.last_error_at_utc || "-"}</Text>
        <Text style={styles.p}>mensagem: {data?.runtime?.last_error || "-"}</Text>
      </Card>

      <Card title="Licença (LIVE)">
        <Text style={styles.p}>válida: {String(data?.license?.valid ?? "-")}</Text>
        <Text style={styles.p}>status: {data?.license?.status || "-"}</Text>
        <Text style={styles.p}>plano: {data?.license?.plan || "-"}</Text>
        <Text style={styles.p}>expira (UTC): {data?.license?.expires_at_utc || "-"}</Text>
        <Text style={styles.p}>motivo: {data?.license?.reason || "-"}</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: theme.colors.bg, gap: 14, flexGrow: 1 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  p: { color: theme.colors.textDim, fontSize: 13, lineHeight: 18 },
  err: { color: "rgba(239,68,68,0.85)", marginTop: 10 }
});

