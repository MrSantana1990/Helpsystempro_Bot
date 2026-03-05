import React from "react";
import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { theme } from "../theme";

export default function Button({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  style
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  style?: ViewStyle;
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
      <Text style={[styles.text, { color: textColor }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  primary: { backgroundColor: theme.colors.accent, borderColor: "rgba(240,185,11,0.5)" },
  secondary: { backgroundColor: "rgba(255,255,255,0.06)" },
  danger: { backgroundColor: "rgba(239,68,68,0.20)", borderColor: "rgba(239,68,68,0.35)" },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.5 },
  text: { fontWeight: "800" }
});

