function fallbackMessageForStatus(status) {
  const code = Number(status || 0);
  if (code === 0) return "Não foi possível conectar ao servidor. Verifique se a API está online.";
  if (code === 400 || code === 422) return "Dados inválidos. Revise os campos e tente novamente.";
  if (code === 401) return "Sessão expirada. Faça login novamente.";
  if (code === 403) return "Acesso negado para esta operação.";
  if (code === 404) return "Recurso não encontrado.";
  if (code === 409) return "Conflito de operação. Atualize a tela e tente novamente.";
  if (code >= 500) return "Servidor indisponível no momento. Tente novamente em instantes.";
  return "Não foi possível concluir a operação.";
}

function normalizeApiError(json, status, statusText) {
  const envelopeMessage = json?.error?.message;
  const code =
    typeof json?.code === "string"
      ? json.code
      : typeof json?.error?.code === "string"
        ? json.error.code
        : "";
  const plainError = typeof json?.error === "string" ? json.error : null;
  const detail = typeof json?.detail === "string" ? json.detail : null;
  const statusMsg = typeof statusText === "string" && statusText.trim() ? statusText : null;
  return {
    message:
      envelopeMessage ||
      detail ||
      plainError ||
      statusMsg ||
      fallbackMessageForStatus(status),
    code: code || undefined
  };
}

function toApiError(json, status, statusText) {
  const normalized = normalizeApiError(json, status, statusText);
  const error = new Error(normalized.message);
  error.code = normalized.code;
  error.status = Number(status || 0);
  return error;
}

async function parseJsonSafe(res) {
  const ct = String(res?.headers?.get?.("content-type") || "").toLowerCase();
  if (!ct.includes("application/json")) return {};
  return res.json().catch(() => ({}));
}

export async function apiGet(path, { token, query } = {}) {
  const url = new URL(path, window.location.origin);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(url.toString(), { cache: "no-store", headers });
  } catch {
    throw new Error(fallbackMessageForStatus(0));
  }
  const json = await parseJsonSafe(res);
  if (!res.ok) {
    throw toApiError(json, res.status, res.statusText);
  }
  return json;
}

export async function apiPost(path, { token, query, body } = {}) {
  const url = new URL(path, window.location.origin);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));
  let res;
  try {
    res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body || {})
    });
  } catch {
    throw new Error(fallbackMessageForStatus(0));
  }
  const json = await parseJsonSafe(res);
  if (!res.ok) {
    throw toApiError(json, res.status, res.statusText);
  }
  return json;
}
