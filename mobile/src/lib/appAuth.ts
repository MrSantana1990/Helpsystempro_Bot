import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

const KEY_USER = "hsp_auth_user_v1";
const KEY_SALT = "hsp_auth_salt_v1";
const KEY_HASH = "hsp_auth_hash_v1";

export type AppAuthStatus = {
  enabled: boolean;
  user: string;
};

function normalizeUser(user: string) {
  return String(user || "").trim().toLowerCase();
}

function randomSalt() {
  return (
    "s_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2) +
    "_" +
    Math.random().toString(36).slice(2)
  );
}

async function sha256(text: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
}

export async function getAppAuthStatus(): Promise<AppAuthStatus> {
  const user = normalizeUser((await SecureStore.getItemAsync(KEY_USER)) || "");
  const salt = (await SecureStore.getItemAsync(KEY_SALT)) || "";
  const hash = (await SecureStore.getItemAsync(KEY_HASH)) || "";
  const enabled = Boolean(user && salt && hash);
  return { enabled, user };
}

export async function setAppCredentials(opts: { user: string; password: string }) {
  const user = normalizeUser(opts.user);
  const password = String(opts.password || "");
  if (!user) throw new Error("Usuário é obrigatório.");
  if (password.length < 6) throw new Error("Senha muito curta (mín. 6).");
  const salt = randomSalt();
  const hash = await sha256(`${salt}:${password}`);
  await SecureStore.setItemAsync(KEY_USER, user);
  await SecureStore.setItemAsync(KEY_SALT, salt);
  await SecureStore.setItemAsync(KEY_HASH, hash);
  return { ok: true, user };
}

export async function verifyAppCredentials(opts: { user: string; password: string }) {
  const user = normalizeUser(opts.user);
  const password = String(opts.password || "");
  const storedUser = normalizeUser((await SecureStore.getItemAsync(KEY_USER)) || "");
  const salt = (await SecureStore.getItemAsync(KEY_SALT)) || "";
  const hash = (await SecureStore.getItemAsync(KEY_HASH)) || "";
  if (!storedUser || !salt || !hash) throw new Error("Login não configurado neste aparelho.");
  if (user !== storedUser) throw new Error("Usuário ou senha inválidos.");
  const attempt = await sha256(`${salt}:${password}`);
  if (attempt !== hash) throw new Error("Usuário ou senha inválidos.");
  return { ok: true, user: storedUser };
}

export async function clearAppCredentials() {
  await SecureStore.deleteItemAsync(KEY_USER);
  await SecureStore.deleteItemAsync(KEY_SALT);
  await SecureStore.deleteItemAsync(KEY_HASH);
  return { ok: true };
}

