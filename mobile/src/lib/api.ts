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

function fallbackMessageForStatus(status: number): string {
  if (status === 0) return "Não foi possível conectar na API. Verifique URL, token e se o servidor está online.";
  if (status === 400 || status === 422) return "Dados inválidos. Revise os campos e tente novamente.";
  if (status === 401) return "Sessão inválida. Faça login novamente.";
  if (status === 403) return "Acesso negado para esta operação.";
  if (status === 404) return "Recurso não encontrado.";
  if (status === 409) return "Conflito de operação. Atualize os dados e tente novamente.";
  if (status >= 500) return "Servidor indisponível no momento. Tente novamente em instantes.";
  return "Não foi possível concluir a operação.";
}

function normalizeApiError(json: any, status: number, statusText?: string): string {
  const envelopeMessage = typeof json?.error?.message === "string" ? json.error.message : "";
  const plainError = typeof json?.error === "string" ? json.error : "";
  const detail = typeof json?.detail === "string" ? json.detail : "";
  const statusMsg = typeof statusText === "string" ? statusText.trim() : "";
  return envelopeMessage || detail || plainError || statusMsg || fallbackMessageForStatus(status);
}

async function parseJsonSafe(res: Response): Promise<any> {
  const ct = String(res.headers.get("content-type") || "").toLowerCase();
  if (!ct.includes("application/json")) return {};
  return res.json().catch(() => ({}));
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
  let res: Response;
  try {
    res = await fetch(url, { headers });
  } catch {
    throw new ApiError(fallbackMessageForStatus(0), 0);
  }
  const json = await parseJsonSafe(res);
  if (!res.ok) {
    const msg = normalizeApiError(json, res.status, res.statusText);
    throw new ApiError(String(msg), res.status, typeof json?.detail === "string" ? json.detail : undefined);
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
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers, body: JSON.stringify(opts.body ?? {}) });
  } catch {
    throw new ApiError(fallbackMessageForStatus(0), 0);
  }
  const json = await parseJsonSafe(res);
  if (!res.ok) {
    const msg = normalizeApiError(json, res.status, res.statusText);
    throw new ApiError(String(msg), res.status, typeof json?.detail === "string" ? json.detail : undefined);
  }
  return json as T;
}
