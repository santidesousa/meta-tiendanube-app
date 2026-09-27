const TZ = "America/Argentina/Buenos_Aires";

export function formatMoney(value, currency = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: currency || "ARS",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function formatPercent(value, digits = 0) {
  return `${(value * 100).toFixed(digits)}%`;
}

/** "2026-09-27" -> "sáb 27 sep" (o "27/9" en modo corto) */
export function formatDayLabel(day, short = false) {
  const [y, m, d] = day.split("-").map(Number);
  if (short) return `${d}/${m}`;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-AR", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Fecha y hora de un pedido en hora argentina */
export function formatDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleString("es-AR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Variacion vs periodo anterior: null si no hay base de comparacion */
export function delta(current, previous) {
  if (previous === null || previous === undefined || previous === 0) return null;
  return (current - previous) / previous;
}
