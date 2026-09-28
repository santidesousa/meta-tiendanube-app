import { formatCompactMoney, formatCompactNumber, formatMoney, formatNumber, formatPercent } from "../format";

// Metricas de cuenta de Meta que se muestran en las tarjetas y en el grafico
// de evolucion. `better`: "up" si es mejor que suba, "down" si es mejor que
// baje (costos), null si es neutra (el gasto no es bueno ni malo en si).
// Los colores van en hex porque los graficos SVG no resuelven var(--...).
export function metricDefs(currency) {
  const money = (v) => formatMoney(v, currency);
  const compactMoney = (v) => formatCompactMoney(v, currency);
  return {
    spend: { label: "Gasto", color: "#94a3b8", better: null, format: money, axis: compactMoney, kind: "bar" },
    purchaseValue: { label: "Ingresos", color: "#1f8a5f", better: "up", format: money, axis: compactMoney, kind: "bar" },
    roas: { label: "ROAS", color: "#e8910c", better: "up", format: (v) => `${v.toFixed(2)}x`, axis: (v) => `${v.toFixed(1)}x` },
    purchases: { label: "Compras", color: "#6366f1", better: "up", format: formatNumber, axis: formatCompactNumber },
    cpa: { label: "CPA", color: "#e0445a", better: "down", format: money, axis: compactMoney },
    aov: { label: "Ticket promedio", short: "AOV", color: "#0f9f8f", better: "up", format: money, axis: compactMoney },
    ctr: { label: "CTR", color: "#2f80d1", better: "up", format: (v) => formatPercent(v, 2), axis: (v) => formatPercent(v, 1) },
    cpc: { label: "CPC", color: "#d9534f", better: "down", format: money, axis: compactMoney },
    cpm: { label: "CPM", color: "#9b5de5", better: "down", format: money, axis: compactMoney },
  };
}

/** "good" | "bad" | "neutral" segun la direccion del cambio y la metrica */
export function changeTone(def, change) {
  if (!def.better || change === 0) return "neutral";
  const improved = def.better === "up" ? change > 0 : change < 0;
  return improved ? "good" : "bad";
}
