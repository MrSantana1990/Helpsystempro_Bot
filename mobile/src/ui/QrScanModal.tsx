import React, { useEffect, useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import Button from "./Button";
import { theme } from "../theme";

export default function QrScanModal({
  visible,
  onClose,
  onScanned
}: {
  visible: boolean;
  onClose: () => void;
  onScanned: (data: string) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLocked(false);
    if (!permission?.granted) requestPermission().catch(() => {});
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.top}>
          <Text style={styles.title}>Escanear QR</Text>
          <Button title="Fechar" variant="secondary" onPress={onClose} />
        </View>

        {!permission ? (
          <View style={styles.center}>
            <Text style={styles.p}>Carregando permissões da câmera…</Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.center}>
            <Text style={styles.p}>Permissão da câmera necessária para escanear QR.</Text>
            <View style={{ height: 12 }} />
            <Button title="Permitir câmera" onPress={() => requestPermission().catch(() => {})} />
            <View style={{ height: 10 }} />
            <Text style={styles.pSmall}>Se você negou antes, ative em Configurações do sistema.</Text>
          </View>
        ) : (
          <View style={styles.cameraWrap}>
            <CameraView
              style={styles.camera}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={(r) => {
                if (locked) return;
                setLocked(true);
                onScanned(String((r as any)?.data || ""));
              }}
            />
            <View style={styles.overlay}>
              <View style={styles.frame} />
              <Text style={styles.hint}>Aponte para o QR do portal (Configurações → Token).</Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  top: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  title: { color: theme.colors.text, fontSize: 16, fontWeight: "900" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16, gap: 8 },
  p: { color: theme.colors.textDim, fontSize: 13, lineHeight: 18, textAlign: "center" },
  pSmall: { color: theme.colors.textMute, fontSize: 12, lineHeight: 16, textAlign: "center" },
  cameraWrap: { flex: 1, position: "relative" },
  camera: { flex: 1 },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    padding: 16
  },
  frame: {
    width: 240,
    height: 240,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(0,0,0,0.10)"
  },
  hint: { marginTop: 14, color: "rgba(255,255,255,0.80)", fontSize: 12, textAlign: "center" }
});
