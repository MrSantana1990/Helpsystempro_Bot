import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";

export default function Badge({ text, tone = "neutral" }: { text: string; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const border =
    tone === "good"
      ? "rgba(34,197,94,0.45)"
      : tone === "warn"
        ? "rgba(245,158,11,0.45)"
        : tone === "bad"
          ? "rgba(239,68,68,0.45)"
          : theme.colors.border;
  return (
    <View style={[styles.base, { borderColor: border }]}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "rgba(15,23,42,0.8)",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  text: { color: theme.colors.textDim, fontSize: 12, fontFamily: "monospace", fontWeight: "700" }
});
