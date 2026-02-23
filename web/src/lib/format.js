export function fmtNumber(n, digits = 2) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "-";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtPrice(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "-";
  const digits = v >= 1000 ? 2 : v >= 1 ? 4 : 8;
  return v.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function fmtPct(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "-";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

