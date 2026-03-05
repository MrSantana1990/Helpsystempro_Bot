import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import Button from "../ui/Button";
import Card from "../ui/Card";
import { theme } from "../theme";
import { apiGet } from "../lib/api";

type Overview = { symbols: string[] };
type Tickers = { rows: Array<{ symbol: string; price: number; change_24h_pct?: number; vol_quote_24h?: number }> };

function fmtPct(n: unknown) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "-";
  const s = x >= 0 ? "+" : "";
  return `${s}${x.toFixed(2)}%`;
}

export default function MarketsScreen({ baseUrl, token }: { baseUrl: string; token: string }) {
  const [symbols, setSymbols] = useState<string[]>(["BTCUSDT", "ETHUSDT", "BNBUSDT"]);
  const [rows, setRows] = useState<Tickers["rows"]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const list = useMemo(() => symbols.filter(Boolean).slice(0, 20), [symbols]);

  const refresh = async () => {
    setErr("");
    setBusy(true);
    try {
      const ov = await apiGet<Overview>(baseUrl, "/api/overview", { token: token || undefined });
      const s = Array.isArray(ov?.symbols) && ov.symbols.length ? ov.symbols : list;
      setSymbols(s);
      const r = await apiGet<Tickers>(baseUrl, "/api/market/tickers", { token: token || undefined, query: { symbols: s.join(",") } });
      setRows(Array.isArray(r?.rows) ? r.rows : []);
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
      <Card title="Mercados (monitorados)">
        <View style={styles.row}>
          <Button title="Atualizar" variant="secondary" onPress={() => refresh()} disabled={busy} style={{ flex: 1 }} />
        </View>
        <View style={{ height: 10 }} />
        {busy ? <ActivityIndicator /> : null}
        {err ? <Text style={[styles.p, styles.err]}>Erro: {err}</Text> : null}
        <View style={{ height: 10 }} />
        <View style={{ gap: 10 }}>
          {rows.map((r) => (
            <View key={r.symbol} style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sym}>{r.symbol}</Text>
                <Text style={styles.meta}>vol 24h: {r.vol_quote_24h ? String(Math.round(r.vol_quote_24h)) : "-"}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.price}>{r.price ? String(r.price) : "-"}</Text>
                <Text style={[styles.meta, Number(r.change_24h_pct) >= 0 ? styles.good : styles.bad]}>{fmtPct(r.change_24h_pct)}</Text>
              </View>
            </View>
          ))}
          {!rows.length && !busy ? <Text style={styles.p}>Sem dados. Verifique baseUrl/token e se a API está acessível.</Text> : null}
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: theme.colors.bg, gap: 14, flexGrow: 1 },
  row: { flexDirection: "row", gap: 10 },
  item: {
    flexDirection: "row",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(0,0,0,0.15)",
    padding: 12
  },
  sym: { color: theme.colors.text, fontWeight: "900", fontSize: 14 },
  price: { color: theme.colors.text, fontWeight: "900", fontSize: 14 },
  meta: { color: theme.colors.textMute, fontSize: 12, marginTop: 2 },
  p: { color: theme.colors.textDim, fontSize: 13, lineHeight: 18 },
  err: { color: "rgba(239,68,68,0.85)" },
  good: { color: "rgba(34,197,94,0.85)" },
  bad: { color: "rgba(239,68,68,0.85)" }
});

