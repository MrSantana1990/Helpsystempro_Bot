import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";

export default function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={styles.wrap}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    padding: 14
  },
  title: { color: theme.colors.text, fontSize: 16, fontWeight: "900", marginBottom: 10 }
});

