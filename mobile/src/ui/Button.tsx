import React from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { theme } from "../theme";

export default function Button({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  style,
  right,
  left
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
  right?: React.ReactNode;
  left?: React.ReactNode;
}) {
  const textColor = variant === "primary" ? "#000" : theme.colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" ? styles.primary : variant === "danger" ? styles.danger : styles.secondary,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style
      ]}
    >
      <View style={styles.row}>
        {left ? <View style={styles.side}>{left}</View> : null}
        <Text style={[styles.text, { color: textColor }]} numberOfLines={1}>
          {title}
        </Text>
        {right ? <View style={styles.side}>{right}</View> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%" },
  side: { flexShrink: 0 },
  primary: { backgroundColor: theme.colors.accent, borderColor: "rgba(240,185,11,0.55)" },
  secondary: { backgroundColor: "rgba(15,23,42,0.85)", borderColor: theme.colors.borderSoft },
  danger: { backgroundColor: "rgba(239,68,68,0.20)", borderColor: "rgba(239,68,68,0.35)" },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.5 },
  text: { fontWeight: "800", fontSize: 14, flexShrink: 1 }
});
