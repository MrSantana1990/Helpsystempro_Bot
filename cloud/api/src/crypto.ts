import crypto from "crypto";
import { getEnv } from "./env.js";

function keyBytes(): Buffer {
  const env = getEnv();
  const raw = Buffer.from(env.HSP_ENCRYPTION_KEY_BASE64, "base64");
  if (raw.length < 32) {
    throw new Error("HSP_ENCRYPTION_KEY_BASE64 deve ser base64 de 32 bytes (AES-256-GCM).");
  }
  return raw.subarray(0, 32);
}

export function encryptText(plain: string): string {
  const iv = crypto.randomBytes(12);
  const key = keyBytes();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from("v1:"), iv, tag, enc]).toString("base64");
}

export function decryptText(encB64: string): string {
  const buf = Buffer.from(String(encB64 || ""), "base64");
  const prefix = buf.subarray(0, 3).toString("utf8");
  if (prefix !== "v1:") throw new Error("Ciphertext inválido.");
  const iv = buf.subarray(3, 15);
  const tag = buf.subarray(15, 31);
  const data = buf.subarray(31);
  const key = keyBytes();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(data), decipher.final()]);
  return out.toString("utf8");
}

