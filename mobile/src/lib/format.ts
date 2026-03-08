export function fmtNumber(v: any, digits = 2) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

export function fmtPrice(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "-";
  const digits = Math.abs(n) >= 100 ? 2 : Math.abs(n) >= 1 ? 4 : 6;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

export function fmtTs(ts: any) {
  const s = String(ts || "");
  if (!s) return "-";
  return s.length >= 19 ? s.slice(0, 19).replace("T", " ") : s;
}

