import React, { useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Field from "../ui/Field";
import { theme } from "../theme";
import { clearSettings, saveSettings } from "../lib/storage";

export default function ConfigScreen({
  baseUrl,
  token,
  onChange
}: {
  baseUrl: string;
  token: string;
  onChange: (next: { baseUrl: string; token: string }) => void;
}) {
  const [b, setB] = useState(baseUrl);
  const [t, setT] = useState(token);
  const [msg, setMsg] = useState("");

  const save = async () => {
    setMsg("");
    const next = { baseUrl: String(b || "").trim().replace(/\/+$/, ""), token: String(t || "").trim() };
    if (!next.baseUrl) {
      setMsg("Erro: Base URL é obrigatória.");
      return;
    }
    await saveSettings(next);
    onChange(next);
    setMsg("OK: salvo.");
  };

  const logout = async () => {
    Alert.alert("Sair", "Limpar conexão salva neste aparelho?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Limpar",
        style: "destructive",
        onPress: async () => {
          await clearSettings();
          onChange({ baseUrl: "", token: "" });
        }
      }
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card title="Conexão">
        <Field label="Base URL da API" value={b} onChangeText={setB} placeholder="ex: https://bot.seudominio.com" keyboardType="url" />
        <View style={{ height: 10 }} />
        <Field label="Token (recomendado)" value={t} onChangeText={setT} placeholder="cole o token" secureTextEntry />
        <View style={{ height: 12 }} />
        <Button title="Salvar" onPress={() => save().catch((e) => setMsg("Erro: " + e.message))} />
        <View style={{ height: 10 }} />
        <Button title="Limpar conexão (logout)" variant="danger" onPress={() => logout().catch(() => {})} />
        {msg ? <Text style={[styles.p, msg.startsWith("Erro") ? styles.err : styles.ok]}>{msg}</Text> : null}
      </Card>

      <Card title="Segurança (resumo)">
        <Text style={styles.p}>
          • Token protege ações sensíveis (Play/Stop/config).{"\n"}
          • Em VPS, use sempre HTTPS e API Key da Binance sem withdraw.{"\n"}
          • Em LAN, prefira rodar com token aleatório (o script -Lan já gera).
        </Text>
        <View style={{ height: 10 }} />
        <Button title="Abrir portfólio" variant="secondary" onPress={() => Linking.openURL("https://helpsystempro.netlify.app/").catch(() => {})} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: theme.colors.bg, gap: 14, flexGrow: 1 },
  p: { color: theme.colors.textDim, fontSize: 13, lineHeight: 18, marginTop: 10 },
  err: { color: "rgba(239,68,68,0.85)" },
  ok: { color: "rgba(34,197,94,0.85)" }
});

