import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";

export default function Card({
  title,
  right,
  children
}: {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      {title ? (
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {right ? <View style={styles.right}>{right}</View> : null}
        </View>
      ) : null}
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 },
  right: { flexShrink: 0 },
  title: { color: theme.colors.text, fontSize: 16, fontWeight: "900", flexShrink: 1 }
});
