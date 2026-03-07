export const CONFIG = {
  apiBase: (import.meta as any).env?.VITE_API_BASE || ""
};

type ApiOpts = {
  token?: string;
  method?: "GET" | "POST";
  body?: unknown;
};

export async function apiJson<T>(path: string, opts: ApiOpts = {}): Promise<T> {
  const url = CONFIG.apiBase ? `${String(CONFIG.apiBase).replace(/\/+$/, "")}${path}` : path;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(url, {
    method: opts.method || "GET",
    headers,
    body: opts.method === "POST" ? JSON.stringify(opts.body ?? {}) : undefined
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error || json?.detail || res.statusText || "Erro";
    throw new Error(String(msg));
  }
  return json as T;
}

