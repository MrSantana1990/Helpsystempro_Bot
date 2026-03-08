import React, { useEffect, useMemo, useState } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { theme } from "./src/theme";
import Button from "./src/ui/Button";
import Badge from "./src/ui/Badge";
import ConnectScreen from "./src/screens/ConnectScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import MarketsScreen from "./src/screens/MarketsScreen";
import TradesScreen from "./src/screens/TradesScreen";
import DecisionsScreen from "./src/screens/DecisionsScreen";
import NewsScreen from "./src/screens/NewsScreen";
import BotScreen from "./src/screens/BotScreen";
import HealthScreen from "./src/screens/HealthScreen";
import LogsScreen from "./src/screens/LogsScreen";
import ConfigScreen from "./src/screens/ConfigScreen";
import { loadSettings, saveSettings, type MobileSettings } from "./src/lib/storage";
import AuthScreen from "./src/screens/AuthScreen";
import { getAppAuthStatus } from "./src/lib/appAuth";

type TabKey = "dashboard" | "markets" | "trades" | "decisions" | "news" | "bot" | "health" | "logs" | "config";

export default function App() {
  const [settings, setSettings] = useState<MobileSettings | null>(null);
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [loaded, setLoaded] = useState(false);
  const [appAuthEnabled, setAppAuthEnabled] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    Promise.all([loadSettings().then((s) => setSettings(s)), getAppAuthStatus().then((s) => setAppAuthEnabled(!!s.enabled))])
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const connected = !!settings?.baseUrl;

  const onConnected = async (s: MobileSettings) => {
    await saveSettings(s);
    setSettings(s);
    setTab("dashboard");
  };

  const onAuthed = async () => {
    const s = await getAppAuthStatus().catch(() => ({ enabled: false, user: "" }));
    setAppAuthEnabled(!!s.enabled);
    setUnlocked(true);
  };

  const content = useMemo(() => {
    if (!connected) return null;
    const baseUrl = settings!.baseUrl;
    const token = settings!.token;
    if (tab === "dashboard") return <DashboardScreen baseUrl={baseUrl} token={token} />;
    if (tab === "markets") return <MarketsScreen baseUrl={baseUrl} token={token} />;
    if (tab === "trades") return <TradesScreen baseUrl={baseUrl} token={token} />;
    if (tab === "decisions") return <DecisionsScreen baseUrl={baseUrl} token={token} />;
    if (tab === "news") return <NewsScreen baseUrl={baseUrl} token={token} />;
    if (tab === "bot") return <BotScreen baseUrl={baseUrl} token={token} />;
    if (tab === "health") return <HealthScreen baseUrl={baseUrl} token={token} />;
    if (tab === "logs") return <LogsScreen baseUrl={baseUrl} token={token} />;
    return (
      <ConfigScreen
        baseUrl={baseUrl}
        token={token}
        onChange={(next) => {
          setSettings(next.baseUrl ? next : null);
          setTab("dashboard");
        }}
        onLock={() => setUnlocked(false)}
      />
    );
  }, [connected, settings, tab]);

  if (!loaded) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.center}>
          <Text style={styles.text}>Carregando…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!connected) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <ConnectScreen initial={settings} onConnected={onConnected} />
      </SafeAreaView>
    );
  }

  if (!unlocked) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <AuthScreen onAuthed={() => onAuthed().catch(() => {})} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>HelpSystem</Text>
          <Text style={styles.sub}>Mobile • Binance Bot</Text>
        </View>
        <Badge text={settings?.token ? "token: OK" : "token: vazio"} tone={settings?.token ? "good" : "warn"} />
      </View>

      <View style={styles.tabs}>
        <TabButton title="Painel" active={tab === "dashboard"} onPress={() => setTab("dashboard")} />
        <TabButton title="Mercados" active={tab === "markets"} onPress={() => setTab("markets")} />
        <TabButton title="Trades" active={tab === "trades"} onPress={() => setTab("trades")} />
        <TabButton title="Decisões" active={tab === "decisions"} onPress={() => setTab("decisions")} />
        <TabButton title="Notícias" active={tab === "news"} onPress={() => setTab("news")} />
        <TabButton title="Bot" active={tab === "bot"} onPress={() => setTab("bot")} />
        <TabButton title="Saúde" active={tab === "health"} onPress={() => setTab("health")} />
        <TabButton title="Logs" active={tab === "logs"} onPress={() => setTab("logs")} />
        <TabButton title="Config" active={tab === "config"} onPress={() => setTab("config")} />
      </View>

      <View style={styles.body}>{content}</View>
    </SafeAreaView>
  );
}

function TabButton({ title, active, onPress }: { title: string; active: boolean; onPress: () => void }) {
  return <Button title={title} onPress={onPress} variant={active ? "primary" : "secondary"} style={styles.tab} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  text: { color: theme.colors.textDim, fontSize: 14 },
  top: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  brand: { color: theme.colors.text, fontSize: 18, fontWeight: "900" },
  sub: { color: theme.colors.textDim, fontSize: 12, marginTop: 2 },
  tabs: { paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", gap: 8, flexWrap: "wrap" },
  tab: { flexGrow: 1 },
  body: { flex: 1 }
});
