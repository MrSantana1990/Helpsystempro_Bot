import React from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import Button from "./Button";
import { theme } from "../theme";

type State = { hasError: boolean; message: string };

function messageFromError(error: unknown): string {
  const msg = String((error as any)?.message || "").trim();
  return msg || "O aplicativo encontrou um erro inesperado.";
}

export default class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: messageFromError(error) };
  }

  componentDidCatch(error: unknown): void {
    // eslint-disable-next-line no-console
    console.error("[mobile] erro não tratado:", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.box}>
          <Text style={styles.title}>Falha inesperada no app</Text>
          <Text style={styles.msg}>{this.state.message}</Text>
          <Text style={styles.note}>Feche e reabra o app para voltar ao estado seguro.</Text>
          <Button title="Tentar novamente" onPress={() => this.setState({ hasError: false, message: "" })} />
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg, alignItems: "center", justifyContent: "center", padding: 18 },
  box: {
    width: "100%",
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 14,
    padding: 14,
    gap: 10
  },
  title: { color: theme.colors.text, fontSize: 18, fontWeight: "900" },
  msg: { color: theme.colors.textDim, fontSize: 13, lineHeight: 18 },
  note: { color: theme.colors.textMute, fontSize: 12 }
});
