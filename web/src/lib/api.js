export async function apiGet(path, { token, query } = {}) {
  const url = new URL(path, window.location.origin);
  if (token) url.searchParams.set("token", token);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));
  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      json?.detail ||
      (json?.error && json?.path ? `${json.error}: ${json.path}` : json?.error) ||
      res.statusText;
    throw new Error(msg);
  }
  return json;
}

export async function apiPost(path, { token, query, body } = {}) {
  const url = new URL(path, window.location.origin);
  if (token) url.searchParams.set("token", token);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      json?.detail ||
      (json?.error && json?.path ? `${json.error}: ${json.path}` : json?.error) ||
      res.statusText;
    throw new Error(msg);
  }
  return json;
}
