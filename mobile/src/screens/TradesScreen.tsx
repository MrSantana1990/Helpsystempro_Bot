import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";
import { apiGet } from "../lib/api";
import { fmtNumber, fmtPrice, fmtTs } from "../lib/format";
import { theme } from "../theme";

type TradeRow = {
  id?: string | number;
  ts_utc?: string;
  symbol?: string;
  side?: string;
  qty?: number;
  price?: number;
};

export default function TradesScreen({ baseUrl, token }: { baseUrl: string; token: string }) {
  const [rows, setRows] = useState<TradeRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const refresh = async () => {
    setErr("");
    setBusy(true);
    try {
      const r = await apiGet<{ rows: TradeRow[] }>(baseUrl, "/api/trades", { token, query: { limit: 200 } });
      setRows(r?.rows || []);
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
      {err ? <Text style={[styles.err]}>{err}</Text> : null}

      <Card
        title="Ordens / Trades"
        right={
          <View style={styles.right}>
            <Badge text={`itens: ${rows.length}`} tone="neutral" />
            <Button title="Atualizar" variant="secondary" onPress={() => refresh().catch(() => {})} />
          </View>
        }
      >
        {busy ? <ActivityIndicator /> : null}
        <View style={{ height: 8 }} />
        {rows.length === 0 ? <Text style={styles.p}>Sem trades ainda.</Text> : null}
        <View style={styles.list}>
          {rows.map((t, idx) => (
            <View key={String(t.id ?? idx)} style={styles.row}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.symbol} numberOfLines={1}>
                  {String(t.symbol || "-")}
                </Text>
                <Text style={styles.ts} numberOfLines={1}>
                  {fmtTs(t.ts_utc)}
                </Text>
              </View>
              <View style={styles.colRight}>
                <Text style={[styles.mono, styles.side]}>{String(t.side || "-")}</Text>
                <Text style={styles.mono}>{fmtNumber(t.qty, 6)}</Text>
                <Text style={styles.mono}>{fmtPrice(t.price)}</Text>
              </View>
            </View>
          ))}
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: theme.colors.bg, gap: 14, flexGrow: 1 },
  right: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
  list: { gap: 10 },
  row: { flexDirection: "row", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: "rgba(0,0,0,0.12)" },
  symbol: { color: theme.colors.text, fontSize: 14, fontWeight: "900" },
  ts: { color: theme.colors.textMute, fontSize: 12, marginTop: 2 },
  colRight: { alignItems: "flex-end", gap: 2 },
  mono: { fontFamily: "monospace", color: theme.colors.textDim, fontSize: 12 },
  side: { color: theme.colors.text },
  p: { color: theme.colors.textDim, fontSize: 13, lineHeight: 18 },
  err: { color: "rgba(239,68,68,0.90)", fontSize: 13 }
});

