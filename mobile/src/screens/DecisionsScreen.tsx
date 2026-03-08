import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Field from "../ui/Field";
import { apiGet } from "../lib/api";
import { fmtNumber, fmtTs } from "../lib/format";
import { theme } from "../theme";

type DecisionRow = {
  id?: string | number;
  ts_utc?: string;
  symbol?: string;
  action?: string;
  score?: number;
  confidence?: number;
  details_json?: any;
};

function parseDetails(row: DecisionRow) {
  const raw: any = (row as any)?.details_json;
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return { raw: String(raw) };
  }
}

function actionTone(action: any): "good" | "bad" | "neutral" | "warn" {
  const a = String(action || "").toUpperCase();
  if (a === "BUY") return "good";
  if (a === "AVOID") return "bad";
  if (a === "HOLD") return "neutral";
  return "warn";
}

export default function DecisionsScreen({ baseUrl, token }: { baseUrl: string; token: string }) {
  const [rows, setRows] = useState<DecisionRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string>("");

  const refresh = async () => {
    setErr("");
    setBusy(true);
    try {
      const r = await apiGet<{ rows: DecisionRow[] }>(baseUrl, "/api/decisions", { token, query: { limit: 500 } });
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

  const latestBySymbol = useMemo(() => {
    const seen = new Set<string>();
    const out: DecisionRow[] = [];
    for (const r of rows) {
      const sym = String(r.symbol || "").toUpperCase();
      if (!sym || seen.has(sym)) continue;
      seen.add(sym);
      out.push(r);
    }
    return out;
  }, [rows]);

  const list = useMemo(() => {
    const qq = String(q || "").trim().toUpperCase();
    const base = latestBySymbol;
    if (!qq) return base;
    return base.filter((r) => String(r.symbol || "").toUpperCase().includes(qq) || String(r.action || "").toUpperCase().includes(qq));
  }, [latestBySymbol, q]);

  useEffect(() => {
    if (sel) return;
    if (list.length > 0) setSel(String(list[0].id));
  }, [list, sel]);

  const row = useMemo(() => rows.find((r) => String(r.id) === String(sel)) || null, [rows, sel]);
  const details = row ? parseDetails(row) : null;
  const explain = (details as any)?.explain || (details as any)?.why || (details as any)?.rationale || null;
  const source = String((details as any)?.source || "-");
  const authorized = (details as any)?.authorized;

  const counts = useMemo(() => {
    const c = { BUY: 0, HOLD: 0, AVOID: 0, total: 0 };
    for (const r of latestBySymbol) {
      const a = String(r.action || "").toUpperCase();
      if (a === "BUY") c.BUY++;
      else if (a === "AVOID") c.AVOID++;
      else c.HOLD++;
      c.total++;
    }
    return c;
  }, [latestBySymbol]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {err ? <Text style={styles.err}>{err}</Text> : null}

      <Card
        title="Decisões (explicáveis)"
        right={
          <View style={styles.right}>
            <Badge text={`moedas: ${counts.total}`} tone="neutral" />
            <Badge text={`BUY: ${counts.BUY}`} tone="good" />
            <Badge text={`HOLD: ${counts.HOLD}`} tone="neutral" />
            <Badge text={`AVOID: ${counts.AVOID}`} tone="bad" />
            <Button title="Atualizar" variant="secondary" onPress={() => refresh().catch(() => {})} />
          </View>
        }
      >
        <Field label="Filtrar (símbolo/ação)" value={q} onChangeText={setQ} placeholder="ex: BTC ou BUY" autoCapitalize="characters" />
        <View style={{ height: 10 }} />
        {busy ? <ActivityIndicator /> : null}
        <View style={{ height: 8 }} />

        <View style={styles.list}>
          {list.map((r) => {
            const active = String(r.id) === String(sel);
            const det = parseDetails(r) || {};
            const src = String((det as any)?.source || "-");
            const auth = (det as any)?.authorized;
            return (
              <Button
                key={String(r.id)}
                title={`${String(r.symbol || "-")} • ${String(r.action || "-")}`}
                variant={active ? "primary" : "secondary"}
                onPress={() => setSel(String(r.id))}
                style={{ justifyContent: "flex-start" } as any}
                right={
                  <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                    {auth === false ? <Badge text="precisa OK" tone="warn" /> : null}
                    <Badge text={src} tone="neutral" />
                    <Badge text={fmtNumber(r.score, 3)} tone={actionTone(r.action)} />
                  </View>
                }
              />
            );
          })}
        </View>
      </Card>

      <Card
        title={row ? `Detalhe • ${String(row.symbol || "-")}` : "Detalhe"}
        right={<Badge text={row ? fmtTs(row.ts_utc) : "-"} tone="neutral" />}
      >
        {!row ? <Text style={styles.p}>Selecione uma decisão acima.</Text> : null}
        {row ? (
          <>
            <View style={styles.badges}>
              <Badge text={`ação: ${String(row.action || "-")}`} tone={actionTone(row.action)} />
              <Badge text={`score: ${fmtNumber(row.score, 3)}`} tone="neutral" />
              <Badge text={`conf.: ${fmtNumber(row.confidence, 3)}`} tone="neutral" />
              <Badge text={`fonte: ${source}`} tone="neutral" />
              {authorized === false ? <Badge text="não autorizado" tone="warn" /> : authorized === true ? <Badge text="autorizado" tone="good" /> : null}
            </View>
            <View style={{ height: 10 }} />
            <Text style={styles.h}>Por quê</Text>
            <Text style={styles.p}>
              {Array.isArray(explain)
                ? explain.map((x: any) => `• ${String(x)}`).join("\n")
                : explain
                  ? typeof explain === "string"
                    ? explain
                    : JSON.stringify(explain, null, 2)
                  : "(sem explicação)"}
            </Text>
            <View style={{ height: 8 }} />
            <Text style={styles.pSmall}>“conf.” é força interna do sinal; não é probabilidade de ganho e não garante lucro.</Text>
          </>
        ) : null}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: theme.colors.bg, gap: 14, flexGrow: 1 },
  right: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
  list: { gap: 10 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  h: { color: theme.colors.text, fontSize: 13, fontWeight: "900" },
  p: { color: theme.colors.textDim, fontSize: 13, lineHeight: 18 },
  pSmall: { color: theme.colors.textMute, fontSize: 12, lineHeight: 16 },
  err: { color: "rgba(239,68,68,0.90)", fontSize: 13 }
});

