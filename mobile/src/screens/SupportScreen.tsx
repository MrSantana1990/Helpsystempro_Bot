import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Field from "../ui/Field";
import Badge from "../ui/Badge";
import { theme } from "../theme";
import { apiGet, apiPost } from "../lib/api";

type SectorRow = { id: string; label: string };
type TicketRow = {
  id: string;
  created_at: string;
  sector: string;
  priority: string;
  status: string;
  subject: string;
};

const EMPTY = {
  sector: "",
  priority: "normal",
  subject: "",
  message: "",
  name: "",
  email: "",
};

export default function SupportScreen({ baseUrl, token }: { baseUrl: string; token: string }) {
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [sectors, setSectors] = useState<SectorRow[]>([]);
  const [priorities, setPriorities] = useState<string[]>(["normal"]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [form, setForm] = useState(EMPTY);

  const load = async () => {
    setCatalogBusy(true);
    setErr("");
    try {
      const [catalog, rows] = await Promise.all([
        apiGet<{ rows: SectorRow[]; priorities: string[] }>(baseUrl, "/api/support/sectors", { token: token || undefined }),
        apiGet<{ rows: TicketRow[] }>(baseUrl, "/api/support/tickets", { token: token || undefined, query: { limit: 20, mine: true } }),
      ]);
      setSectors(Array.isArray(catalog.rows) ? catalog.rows : []);
      setPriorities(Array.isArray(catalog.priorities) && catalog.priorities.length ? catalog.priorities : ["normal"]);
      setTickets(Array.isArray(rows.rows) ? rows.rows : []);
    } catch (e: any) {
      setErr(e?.message || "Não foi possível carregar o suporte.");
    } finally {
      setCatalogBusy(false);
    }
  };

  useEffect(() => {
    load().catch(() => {});
  }, [baseUrl, token]);

  const canSend = useMemo(() => {
    return form.sector && form.subject.trim().length >= 5 && form.message.trim().length >= 10;
  }, [form]);

  const submit = async () => {
    setSendBusy(true);
    setMsg("");
    setErr("");
    try {
      const payload = {
        ...form,
        channel: "mobile",
        platform: "app_mobile",
        context: { app: "helpsystem-mobile", ts: new Date().toISOString() },
      };
      const result = await apiPost<{ message?: string; ticket?: TicketRow }>(baseUrl, "/api/support/tickets", {
        token: token || undefined,
        body: payload,
      });
      const id = String(result?.ticket?.id || "").trim();
      setMsg(id ? `Chamado ${id} aberto com sucesso.` : result?.message || "Chamado aberto com sucesso.");
      setForm((prev) => ({ ...prev, subject: "", message: "" }));
      await load();
    } catch (e: any) {
      setErr(e?.message || "Não foi possível abrir chamado.");
    } finally {
      setSendBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {err ? <Text style={[styles.feedback, styles.err]}>{err}</Text> : null}
      {msg ? <Text style={[styles.feedback, styles.ok]}>{msg}</Text> : null}

      <Card
        title="Central de suporte"
        right={<Badge text={catalogBusy ? "sincronizando" : "online"} tone={catalogBusy ? "warn" : "good"} />}
      >
        <Text style={styles.copy}>Abra um chamado sem sair do app. Selecione o setor correto para acelerar o atendimento.</Text>
        <View style={{ height: 12 }} />
        <Text style={styles.label}>Setor</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 6 }}>
          {sectors.map((s) => {
            const active = form.sector === s.id;
            return (
              <Button
                key={s.id}
                title={s.label}
                variant={active ? "primary" : "secondary"}
                onPress={() => setForm((prev) => ({ ...prev, sector: s.id }))}
                style={{ minWidth: 140 }}
              />
            );
          })}
        </ScrollView>

        <View style={{ height: 8 }} />
        <Text style={styles.label}>Prioridade</Text>
        <View style={styles.rowWrap}>
          {priorities.map((p) => (
            <Button
              key={p}
              title={String(p).toUpperCase()}
              variant={form.priority === p ? "primary" : "secondary"}
              onPress={() => setForm((prev) => ({ ...prev, priority: p }))}
              style={{ minWidth: 92 }}
            />
          ))}
        </View>

        <View style={{ height: 10 }} />
        <Field label="Assunto" value={form.subject} onChangeText={(v) => setForm((prev) => ({ ...prev, subject: v }))} placeholder="Ex.: erro ao iniciar bot" />
        <View style={{ height: 10 }} />
        <Text style={styles.label}>Mensagem</Text>
        <TextInput
          value={form.message}
          onChangeText={(v) => setForm((prev) => ({ ...prev, message: v }))}
          placeholder="Descreva o problema, os passos e o resultado esperado."
          placeholderTextColor={theme.colors.textMute}
          multiline
          numberOfLines={5}
          style={styles.textArea}
        />
        <View style={{ height: 10 }} />
        <Field label="Nome (opcional)" value={form.name} onChangeText={(v) => setForm((prev) => ({ ...prev, name: v }))} placeholder="Seu nome" autoCapitalize="words" />
        <View style={{ height: 10 }} />
        <Field
          label="E-mail para retorno (opcional)"
          value={form.email}
          onChangeText={(v) => setForm((prev) => ({ ...prev, email: v }))}
          placeholder="voce@dominio.com"
          keyboardType="default"
        />

        <View style={{ height: 12 }} />
        <View style={styles.rowWrap}>
          <Button title={sendBusy ? "Enviando..." : "Abrir chamado"} onPress={() => submit()} disabled={!canSend || sendBusy} style={{ flex: 1 }} />
          <Button title="Limpar" variant="secondary" onPress={() => setForm(EMPTY)} disabled={sendBusy} style={{ width: 110 }} />
        </View>
      </Card>

      <Card title="Histórico recente">
        {catalogBusy ? (
          <ActivityIndicator />
        ) : tickets.length === 0 ? (
          <Text style={styles.copy}>Nenhum chamado registrado.</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {tickets.map((t) => (
              <View key={t.id} style={styles.ticket}>
                <View style={styles.ticketTop}>
                  <Text style={styles.ticketId}>{t.id}</Text>
                  <Badge text={String(t.status || "aberto")} tone={String(t.status || "").toLowerCase() === "aberto" ? "warn" : "good"} />
                </View>
                <Text style={styles.ticketSubject}>{t.subject || "-"}</Text>
                <Text style={styles.ticketMeta}>
                  setor: {t.sector || "-"} • prioridade: {String(t.priority || "").toUpperCase()} •{" "}
                  {String(t.created_at || "").replace("T", " ").slice(0, 19)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: theme.colors.bg, gap: 14, flexGrow: 1 },
  feedback: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontWeight: "700" },
  err: { color: "#fecaca", backgroundColor: "rgba(127,29,29,0.35)", borderColor: "rgba(248,113,113,0.5)" },
  ok: { color: "#bbf7d0", backgroundColor: "rgba(21,128,61,0.30)", borderColor: "rgba(74,222,128,0.45)" },
  copy: { color: theme.colors.textDim, fontSize: 13, lineHeight: 19 },
  label: { color: theme.colors.textDim, fontSize: 12, fontWeight: "700" },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  textArea: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.inputBg,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 110,
    color: theme.colors.text,
    textAlignVertical: "top",
  },
  ticket: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    backgroundColor: "rgba(2,6,23,0.55)",
    padding: 10,
    gap: 4,
  },
  ticketTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  ticketId: { color: theme.colors.text, fontFamily: "monospace", fontSize: 12, fontWeight: "800" },
  ticketSubject: { color: theme.colors.text, fontWeight: "800", fontSize: 14 },
  ticketMeta: { color: theme.colors.textDim, fontSize: 12, lineHeight: 17 },
});
