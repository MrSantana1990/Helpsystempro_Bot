import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Field from "../ui/Field";
import { apiGet } from "../lib/api";
import { theme } from "../theme";

export default function LogsScreen({ baseUrl, token }: { baseUrl: string; token: string }) {
  const [lines, setLines] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [n, setN] = useState("300");

  const refresh = async () => {
    setErr("");
    setBusy(true);
    try {
      const r = await apiGet<{ path: string; lines: string[] }>(baseUrl, "/api/logs", { token, query: { lines: Number(n) || 300 } });
      setLines(r?.lines || []);
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
      {err ? <Text style={styles.err}>{err}</Text> : null}

      <Card
        title="Logs (auditoria)"
        right={
          <View style={styles.right}>
            <Badge text={`linhas: ${lines.length}`} tone="neutral" />
            <Button title="Atualizar" variant="secondary" onPress={() => refresh().catch(() => {})} />
          </View>
        }
      >
        <Field label="Quantidade" value={n} onChangeText={setN} placeholder="300" keyboardType="numeric" />
        <View style={{ height: 10 }} />
        <Button title="Recarregar" onPress={() => refresh().catch(() => {})} disabled={busy} />
        <View style={{ height: 10 }} />
        {busy ? <ActivityIndicator /> : null}
        <View style={{ height: 10 }} />
        <View style={styles.box}>
          <Text style={styles.mono}>{lines.join("\n") || "(sem logs)"}</Text>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: theme.colors.bg, gap: 14, flexGrow: 1 },
  right: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
  box: { borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: "rgba(0,0,0,0.16)", padding: 12 },
  mono: { fontFamily: "monospace", color: theme.colors.textDim, fontSize: 11, lineHeight: 16 },
  err: { color: "rgba(239,68,68,0.90)", fontSize: 13 }
});

