import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Field from "../ui/Field";
import QrScanModal from "../ui/QrScanModal";
import { theme } from "../theme";
import { apiGet } from "../lib/api";
import { parseConnectQr } from "../lib/qr";
import type { MobileSettings } from "../lib/storage";

export default function ConnectScreen({
  initial,
  onConnected
}: {
  initial: MobileSettings | null;
  onConnected: (settings: MobileSettings) => void;
}) {
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl || "");
  const [token, setToken] = useState(initial?.token || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [scanOn, setScanOn] = useState(false);

  const canSubmit = useMemo(() => String(baseUrl).trim().length > 0, [baseUrl]);

  const test = async () => {
    setMsg("");
    setBusy(true);
    try {
      const b = String(baseUrl || "").trim().replace(/\/+$/, "");
      const r = await apiGet<{ ok: boolean }>(b, "/api/health", { token: token.trim() || undefined });
      if (!r?.ok) throw new Error("API respondeu, mas ok!=true.");
      setMsg("OK: conexão validada.");
      onConnected({ baseUrl: b, token: token.trim() });
    } catch (e: any) {
      setMsg("Erro: " + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.brand}>HelpSystem</Text>
        <Text style={styles.subtitle}>App Mobile (Android/iOS) — painel do Binance Bot</Text>
      </View>

      <Card title="Conexão">
        <Text style={styles.p}>
          Para usar no celular, o backend precisa estar acessível:
          {"\n"}• Local (LAN): rode <Text style={styles.mono}>.\run_local.ps1 -Lan</Text> no PC e use o IP do PC.
          {"\n"}• VPS: use o domínio HTTPS.
        </Text>
        <View style={{ height: 10 }} />
        <Field
          label="Base URL da API"
          value={baseUrl}
          onChangeText={setBaseUrl}
          placeholder="ex: https://bot.seudominio.com ou http://192.168.0.10:8502"
          keyboardType="url"
        />
        <View style={{ height: 10 }} />
        <Field label="Token (recomendado)" value={token} onChangeText={setToken} placeholder="cole o token do console" secureTextEntry />
        <View style={{ height: 12 }} />
        <Button title="Escanear QR do portal" variant="secondary" onPress={() => setScanOn(true)} disabled={busy} />
        <View style={{ height: 10 }} />
        <Button title="Testar conexão" onPress={() => test()} disabled={!canSubmit || busy} />
        <View style={{ height: 10 }} />
        {busy ? <ActivityIndicator /> : null}
        {msg ? <Text style={[styles.p, msg.startsWith("Erro") ? styles.err : styles.ok]}>{msg}</Text> : null}
      </Card>

      <Card title="Aviso (compliance)">
        <Text style={styles.p}>
          Este app é uma interface operacional. Não é recomendação financeira e não há garantia de lucro.
          Comece com dry-run/testnet e use limites de risco.
        </Text>
        <View style={{ height: 10 }} />
        <Button
          title="Abrir documentação (site)"
          variant="secondary"
          onPress={() => Linking.openURL("https://helpsystempro.netlify.app/").catch(() => {})}
        />
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
            Alert.alert("QR lido", "Dados aplicados. Agora toque em “Testar conexão”.");
          }
          setBaseUrl(p.baseUrl);
          setToken(p.token);
          setMsg("OK: dados do QR aplicados. Agora teste a conexão.");
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: theme.colors.bg, gap: 14, flexGrow: 1 },
  header: { gap: 6, marginTop: 10 },
  brand: { color: theme.colors.text, fontSize: 22, fontWeight: "900" },
  subtitle: { color: theme.colors.textDim, fontSize: 13 },
  p: { color: theme.colors.textDim, fontSize: 13, lineHeight: 18 },
  mono: { fontFamily: "monospace", color: theme.colors.text },
  err: { color: "rgba(239,68,68,0.85)" },
  ok: { color: "rgba(34,197,94,0.85)" }
});
