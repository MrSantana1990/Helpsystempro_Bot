import React, { useEffect, useMemo, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { theme } from "./src/theme";
import Button from "./src/ui/Button";
import Badge from "./src/ui/Badge";
import AppErrorBoundary from "./src/ui/AppErrorBoundary";
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
import SupportScreen from "./src/screens/SupportScreen";
import { loadSettings, saveSettings, type MobileSettings } from "./src/lib/storage";
import AuthScreen from "./src/screens/AuthScreen";
import { getAppAuthStatus } from "./src/lib/appAuth";

type TabKey =
  | "dashboard"
  | "markets"
  | "trades"
  | "decisions"
  | "news"
  | "bot"
  | "health"
  | "logs"
  | "support"
  | "config";

const TAB_ITEMS: { key: TabKey; title: string; icon: string }[] = [
  { key: "dashboard", title: "Painel", icon: "◉" },
  { key: "markets", title: "Mercados", icon: "≈" },
  { key: "trades", title: "Trades", icon: "⇄" },
  { key: "decisions", title: "Decisões", icon: "◎" },
  { key: "news", title: "Notícias", icon: "✦" },
  { key: "bot", title: "Bot", icon: "▶" },
  { key: "health", title: "Saúde", icon: "♥" },
  { key: "logs", title: "Logs", icon: "≡" },
  { key: "support", title: "Suporte", icon: "?" },
  { key: "config", title: "Config", icon: "⚙" },
];

export default function App() {
  const [settings, setSettings] = useState<MobileSettings | null>(null);
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [loaded, setLoaded] = useState(false);
  const [appAuthEnabled, setAppAuthEnabled] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    Promise.all([
      loadSettings().then((s) => setSettings(s)),
      getAppAuthStatus().then((s) => setAppAuthEnabled(!!s.enabled)),
    ])
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
    if (tab === "support") return <SupportScreen baseUrl={baseUrl} token={token} />;
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
      <AppErrorBoundary>
        <SafeAreaView style={styles.safe}>
          <StatusBar style="light" />
          <View style={styles.center}>
            <Text style={styles.text}>Carregando...</Text>
          </View>
        </SafeAreaView>
      </AppErrorBoundary>
    );
  }

  if (!connected) {
    return (
      <AppErrorBoundary>
        <SafeAreaView style={styles.safe}>
          <StatusBar style="light" />
          <ConnectScreen initial={settings} onConnected={onConnected} />
        </SafeAreaView>
      </AppErrorBoundary>
    );
  }

  if (!unlocked) {
    return (
      <AppErrorBoundary>
        <SafeAreaView style={styles.safe}>
          <StatusBar style="light" />
          <AuthScreen onAuthed={() => onAuthed().catch(() => {})} />
        </SafeAreaView>
      </AppErrorBoundary>
    );
  }

  return (
    <AppErrorBoundary>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />

        <View style={styles.hero}>
          <View style={styles.heroGlowTop} />
          <View style={styles.heroGlowBottom} />
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.brand}>HelpSystem</Text>
              <Text style={styles.sub}>Mobile • Central inteligente</Text>
            </View>
            <Badge text={settings?.token ? "token: OK" : "token: vazio"} tone={settings?.token ? "good" : "warn"} />
          </View>
          <View style={styles.heroPills}>
            <Badge text={appAuthEnabled ? "2FA local: ativo" : "2FA local: inativo"} tone={appAuthEnabled ? "good" : "warn"} />
            <Badge text={`base: ${String(settings?.baseUrl || "-").replace(/^https?:\/\//, "")}`} />
          </View>
        </View>

        <View style={styles.tabsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
            {TAB_ITEMS.map((item) => {
              const active = item.key === tab;
              return (
                <Button
                  key={item.key}
                  title={`${item.icon} ${item.title}`}
                  variant={active ? "primary" : "secondary"}
                  onPress={() => setTab(item.key)}
                  style={active ? [styles.tab, styles.tabActive] : styles.tab}
                />
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.body}>{content}</View>
      </SafeAreaView>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  text: { color: theme.colors.textDim, fontSize: 14 },
  hero: {
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.panel,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    overflow: "hidden",
  },
  heroGlowTop: {
    position: "absolute",
    top: -20,
    right: -10,
    width: 140,
    height: 90,
    borderRadius: 60,
    backgroundColor: "rgba(34,211,238,0.12)",
  },
  heroGlowBottom: {
    position: "absolute",
    bottom: -25,
    left: -10,
    width: 180,
    height: 90,
    borderRadius: 70,
    backgroundColor: "rgba(139,92,246,0.10)",
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroPills: { marginTop: 10, flexDirection: "row", gap: 8, flexWrap: "wrap" },
  brand: { color: theme.colors.text, fontSize: 22, fontWeight: "900", letterSpacing: 0.4 },
  sub: { color: theme.colors.textDim, fontSize: 12, marginTop: 2 },
  tabsWrap: { paddingHorizontal: 12, paddingBottom: 6 },
  tabsContent: { gap: 8, paddingHorizontal: 2 },
  tab: { minWidth: 120 },
  tabActive: { shadowColor: "#f0b90b", shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  body: { flex: 1 },
});
