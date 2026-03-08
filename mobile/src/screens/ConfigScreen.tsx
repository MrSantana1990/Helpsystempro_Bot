import React, { useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Field from "../ui/Field";
import QrScanModal from "../ui/QrScanModal";
import { theme } from "../theme";
import { clearSettings, saveSettings } from "../lib/storage";
import { clearAppCredentials, getAppAuthStatus } from "../lib/appAuth";
import { parseConnectQr } from "../lib/qr";

export default function ConfigScreen({
  baseUrl,
  token,
  onChange,
  onLock
}: {
  baseUrl: string;
  token: string;
  onChange: (next: { baseUrl: string; token: string }) => void;
  onLock?: () => void;
}) {
  const [b, setB] = useState(baseUrl);
  const [t, setT] = useState(token);
  const [msg, setMsg] = useState("");
  const [scanOn, setScanOn] = useState(false);

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
        <Button title="Escanear QR do portal" variant="secondary" onPress={() => setScanOn(true)} />
        <View style={{ height: 10 }} />
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

      <Card title="Segurança do app (login)">
        <Text style={styles.p}>
          Este app exige usuário e senha local (offline) para abrir. Isso é separado do token da API e não cria multiusuário na nuvem.
        </Text>
        <View style={{ height: 10 }} />
        <Button
          title="Redefinir usuário/senha"
          variant="secondary"
          onPress={() => {
            Alert.alert("Redefinir login", "Isso vai apagar o usuário/senha deste aparelho e voltar para a tela de login.", [
              { text: "Cancelar", style: "cancel" },
              {
                text: "Redefinir",
                style: "destructive",
                onPress: async () => {
                  await clearAppCredentials().catch(() => {});
                  const st = await getAppAuthStatus().catch(() => ({ enabled: false, user: "" }));
                  if (!st.enabled) onLock?.();
                }
              }
            ]);
          }}
        />
        <View style={{ height: 10 }} />
        <Button title="Bloquear agora" variant="danger" onPress={() => onLock?.()} />
      </Card>

      <QrScanModal
        visible={scanOn}
        onClose={() => setScanOn(false)}
        onScanned={(data) => {
          setScanOn(false);
          const p = parseConnectQr(data);
          if (!p) {
            Alert.alert("QR inválido", "Gere o QR no portal (Configurações → Token) e tente novamente.");
            setMsg("Erro: QR inválido. Gere o QR no portal (Configurações → Token).");
            return;
          }
          if (/localhost|127\.0\.0\.1/i.test(p.baseUrl)) {
            Alert.alert(
              "QR com localhost",
              "Esse QR foi gerado com “localhost”, que não funciona no celular. Abra o painel no PC usando http://SEU_IP:8501 (modo -Lan) e gere o QR novamente."
            );
          } else {
            Alert.alert("QR lido", "Dados aplicados. Agora toque em “Salvar”.");
          }
          setB(p.baseUrl);
          setT(p.token);
          setMsg("OK: dados do QR aplicados. Agora clique em Salvar.");
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: theme.colors.bg, gap: 14, flexGrow: 1 },
  p: { color: theme.colors.textDim, fontSize: 13, lineHeight: 18, marginTop: 10 },
  err: { color: "rgba(239,68,68,0.85)" },
  ok: { color: "rgba(34,197,94,0.85)" }
});
