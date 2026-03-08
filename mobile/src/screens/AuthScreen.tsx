import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Field from "../ui/Field";
import { theme } from "../theme";
import { getAppAuthStatus, setAppCredentials, verifyAppCredentials } from "../lib/appAuth";

export default function AuthScreen({ onAuthed }: { onAuthed: () => void }) {
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"setup" | "login">("login");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");

  useEffect(() => {
    getAppAuthStatus()
      .then((s) => setMode(s.enabled ? "login" : "setup"))
      .finally(() => setLoading(false));
  }, []);

  const canSubmit = useMemo(() => {
    if (!user.trim() || !pass) return false;
    if (mode === "setup") return pass.length >= 6 && pass === pass2;
    return true;
  }, [mode, user, pass, pass2]);

  const submit = async () => {
    setMsg("");
    setBusy(true);
    try {
      if (mode === "setup") {
        await setAppCredentials({ user, password: pass });
        Alert.alert("Login criado", "Agora você já pode entrar com usuário e senha.");
        setMode("login");
        setPass("");
        setPass2("");
        return;
      }
      await verifyAppCredentials({ user, password: pass });
      onAuthed();
    } catch (e: any) {
      setMsg("Erro: " + (e?.message || String(e)));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator />
        <Text style={styles.p}>Carregando…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.brand}>HelpSystem</Text>
        <Text style={styles.subtitle}>Acesso ao app</Text>
      </View>

      <Card title={mode === "setup" ? "Criar usuário e senha" : "Entrar"}>
        <View style={styles.row}>
          <Badge text={mode === "setup" ? "primeiro acesso" : "login"} tone={mode === "setup" ? "warn" : "good"} />
          <Button
            title={mode === "setup" ? "Já tenho login" : "Criar login"}
            variant="secondary"
            onPress={() => {
              setMsg("");
              setMode((m) => (m === "setup" ? "login" : "setup"));
              setPass("");
              setPass2("");
            }}
          />
        </View>

        <View style={{ height: 12 }} />
        <Field label="Usuário" value={user} onChangeText={setUser} placeholder="ex: admin" autoCapitalize="none" />
        <View style={{ height: 10 }} />
        <Field label="Senha" value={pass} onChangeText={setPass} placeholder="mín. 6 caracteres" secureTextEntry />
        {mode === "setup" ? (
          <>
            <View style={{ height: 10 }} />
            <Field label="Confirmar senha" value={pass2} onChangeText={setPass2} placeholder="repita a senha" secureTextEntry />
            <View style={{ height: 10 }} />
            <Text style={styles.note}>
              Nota: isso é um bloqueio local do app (offline). Para multiusuário/planos/2FA, use o Cloud Admin na fase Cloud.
            </Text>
          </>
        ) : null}

        <View style={{ height: 12 }} />
        <Button
          title={mode === "setup" ? "Criar login" : "Entrar"}
          onPress={() => submit().catch(() => {})}
          disabled={!canSubmit || busy}
        />
        <View style={{ height: 10 }} />
        {busy ? <ActivityIndicator /> : null}
        {msg ? <Text style={[styles.p, msg.startsWith("Erro") ? styles.err : styles.ok]}>{msg}</Text> : null}
      </Card>

      <Card title="Compliance (curto)">
        <Text style={styles.p}>
          Não é recomendação financeira. Não há garantia de lucro. Use dry-run/testnet primeiro e aplique limites de risco.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: theme.colors.bg, gap: 14, flexGrow: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { gap: 6, marginTop: 10 },
  brand: { color: theme.colors.text, fontSize: 22, fontWeight: "900" },
  subtitle: { color: theme.colors.textDim, fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  p: { color: theme.colors.textDim, fontSize: 13, lineHeight: 18 },
  note: { color: theme.colors.textMute, fontSize: 12, lineHeight: 16 },
  err: { color: "rgba(239,68,68,0.85)" },
  ok: { color: "rgba(34,197,94,0.85)" }
});

