export class ApiError extends Error {
  status: number;
  detail?: string;
  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function buildUrl(baseUrl: string, path: string, query?: Record<string, string | number | boolean | undefined>) {
  const base = String(baseUrl || "").trim().replace(/\/+$/, "");
  const p = String(path || "").trim();
  const url = new URL(p.startsWith("http") ? p : `${base}${p.startsWith("/") ? "" : "/"}${p}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export async function apiGet<T>(
  baseUrl: string,
  path: string,
  opts: { token?: string; query?: Record<string, string | number | boolean | undefined> } = {}
): Promise<T> {
  const url = buildUrl(baseUrl, path, opts.query);
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(url, { headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.detail || json?.error || res.statusText || "Erro";
    throw new ApiError(String(msg), res.status, json?.detail);
  }
  return json as T;
}

export async function apiPost<T>(
  baseUrl: string,
  path: string,
  opts: { token?: string; query?: Record<string, string | number | boolean | undefined>; body?: unknown } = {}
): Promise<T> {
  const url = buildUrl(baseUrl, path, opts.query);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(opts.body ?? {}) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.detail || json?.error || res.statusText || "Erro";
    throw new ApiError(String(msg), res.status, json?.detail);
  }
  return json as T;
}

