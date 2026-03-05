import * as SecureStore from "expo-secure-store";

const KEY_SETTINGS = "hsp_mobile_settings_v1";

export type MobileSettings = {
  baseUrl: string;
  token: string;
};

export async function loadSettings(): Promise<MobileSettings | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY_SETTINGS);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    const baseUrl = String(obj?.baseUrl || "").trim();
    const token = String(obj?.token || "").trim();
    if (!baseUrl) return null;
    return { baseUrl, token };
  } catch {
    return null;
  }
}

export async function saveSettings(settings: MobileSettings): Promise<void> {
  const baseUrl = String(settings.baseUrl || "")
    .trim()
    .replace(/\/+$/, "");
  const token = String(settings.token || "").trim();
  await SecureStore.setItemAsync(KEY_SETTINGS, JSON.stringify({ baseUrl, token }));
}

export async function clearSettings(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY_SETTINGS);
  } catch {
    // ignore
  }
}

