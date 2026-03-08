import React, { useEffect, useState } from "react";
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Field from "../ui/Field";
import { apiGet } from "../lib/api";
import { fmtNumber, fmtTs } from "../lib/format";
import { theme } from "../theme";

type NewsRow = {
  title?: string;
  description?: string;
  url?: string;
  publishedAt?: string;
  source?: string;
  sentiment?: number;
  class?: "positivo" | "negativo" | "neutro";
};

export default function NewsScreen({ baseUrl, token }: { baseUrl: string; token: string }) {
  const [term, setTerm] = useState("crypto");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [msg, setMsg] = useState("");
  const [avg, setAvg] = useState<number | null>(null);
  const [rows, setRows] = useState<NewsRow[]>([]);

  const refresh = async () => {
    setErr("");
    setBusy(true);
    try {
      const r = await apiGet<any>(baseUrl, "/api/news", { token, query: { term: term.trim() || "crypto", limit: 12 } });
      setEnabled(!!r?.enabled);
      setMsg(String(r?.message || ""));
      setAvg(Number.isFinite(Number(r?.avg_sentiment)) ? Number(r.avg_sentiment) : null);
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

  const toneByClass = (c: any): "good" | "bad" | "neutral" | "warn" => {
    const v = String(c || "").toLowerCase();
    if (v === "positivo") return "good";
    if (v === "negativo") return "bad";
    if (v === "neutro") return "neutral";
    return "warn";
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {err ? <Text style={styles.err}>{err}</Text> : null}

      <Card
        title="Notícias (resumo)"
        right={
          <View style={styles.right}>
            <Button title="Atualizar" variant="secondary" onPress={() => refresh().catch(() => {})} />
          </View>
        }
      >
        <Field label="Termo" value={term} onChangeText={setTerm} placeholder="ex: bitcoin" />
        <View style={{ height: 10 }} />
        <Button title="Buscar" onPress={() => refresh().catch(() => {})} disabled={busy} />
        <View style={{ height: 10 }} />
        {busy ? <ActivityIndicator /> : null}

        {enabled === false ? (
          <Text style={styles.p}>
            {msg || "NEWS_API_KEY não configurada. Vá no portal web em Configurações → Passo 1 e salve a chave."}
          </Text>
        ) : null}

        {enabled ? (
          <View style={styles.stats}>
            <Badge text={`itens: ${rows.length}`} tone="neutral" />
            <Badge text={`sent. médio: ${avg == null ? "-" : fmtNumber(avg, 3)}`} tone="neutral" />
          </View>
        ) : null}

        <View style={{ height: 10 }} />
        <View style={styles.list}>
          {rows.map((n, idx) => (
            <View key={idx} style={styles.row}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.title} numberOfLines={2}>
                  {String(n.title || "-")}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {String(n.source || "-")} • {fmtTs(n.publishedAt)}
                </Text>
                {n.description ? (
                  <Text style={styles.desc} numberOfLines={3}>
                    {String(n.description)}
                  </Text>
                ) : null}
              </View>
              <View style={{ alignItems: "flex-end", gap: 8 }}>
                <Badge text={String(n.class || "-")} tone={toneByClass(n.class)} />
                <Badge text={fmtNumber(n.sentiment, 3)} tone="neutral" />
                <Button
                  title="Abrir"
                  variant="secondary"
                  onPress={() => {
                    const u = String(n.url || "").trim();
                    if (!u) return;
                    Linking.openURL(u).catch(() => {});
                  }}
                />
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 8 }} />
        <Text style={styles.pSmall}>Sentimento é apenas um sinal auxiliar (não é promessa de ganho e não garante lucro).</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: theme.colors.bg, gap: 14, flexGrow: 1 },
  right: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  list: { gap: 10, marginTop: 6 },
  row: { flexDirection: "row", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: "rgba(0,0,0,0.12)" },
  title: { color: theme.colors.text, fontSize: 13, fontWeight: "900" },
  meta: { color: theme.colors.textMute, fontSize: 12, marginTop: 3 },
  desc: { color: theme.colors.textDim, fontSize: 12, lineHeight: 16, marginTop: 6 },
  p: { color: theme.colors.textDim, fontSize: 13, lineHeight: 18, marginTop: 10 },
  pSmall: { color: theme.colors.textMute, fontSize: 12, lineHeight: 16 },
  err: { color: "rgba(239,68,68,0.90)", fontSize: 13 }
});

