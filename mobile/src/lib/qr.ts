function safeUrl(s: string): string {
  return String(s || "")
    .trim()
    .replace(/\/+$/, "");
}

export type ConnectQr = { baseUrl: string; token: string };

export function parseConnectQr(raw: string): ConnectQr | null {
  const text = String(raw || "").trim();
  if (!text) return null;

  // 1) JSON: {"kind":"helpsystem-connect","baseUrl":"...","token":"..."}
  try {
    const obj = JSON.parse(text);
    if (obj && typeof obj === "object") {
      const baseUrl = safeUrl(String((obj as any).baseUrl || ""));
      const token = String((obj as any).token || "").trim();
      if (baseUrl) return { baseUrl, token };
    }
  } catch {}

  // 2) URL com query: ...?baseUrl=...&token=...
  try {
    const u = new URL(text);
    const baseUrl = safeUrl(u.searchParams.get("baseUrl") || "");
    const token = String(u.searchParams.get("token") || "").trim();
    if (baseUrl) return { baseUrl, token };
  } catch {}

  // 3) Formato simples: HSP_CONNECT|baseUrl|token
  if (text.startsWith("HSP_CONNECT|")) {
    const parts = text.split("|");
    const baseUrl = safeUrl(parts[1] || "");
    const token = String(parts[2] || "").trim();
    if (baseUrl) return { baseUrl, token };
  }

  return null;
}

