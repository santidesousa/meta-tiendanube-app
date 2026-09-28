import { formatCompactMoney, formatCompactNumber, formatMoney, formatNumber, formatPercent } from "../format";
import { formatDuration } from "@/lib/gaMetrics";

// Metricas de Google Analytics para las tarjetas y el grafico de evolucion
// (formato de cada definicion: ver app/dashboard/MetricCards.js).
export function metricDefs(currency) {
  const money = (v) => formatMoney(v, currency);
  const compactMoney = (v) => formatCompactMoney(v, currency);
  const pct = (v) => formatPercent(v, 1);
  return {
    sessions: { label: "Sesiones", color: "#94a3b8", better: "up", format: formatNumber, axis: formatCompactNumber, kind: "bar" },
    users: { label: "Usuarios", color: "#2f80d1", better: "up", format: formatNumber, axis: formatCompactNumber, kind: "bar" },
    newUsers: { label: "Usuarios nuevos", color: "#6366f1", better: "up", format: formatNumber, axis: formatCompactNumber },
    engagementRate: { label: "Tasa de interacción", short: "Interacción", color: "#0f9f8f", better: "up", format: pct, axis: pct },
    avgEngagementTime: { label: "Tiempo medio", color: "#9b5de5", better: "up", format: formatDuration, axis: formatDuration },
    purchases: { label: "Compras", color: "#e8910c", better: "up", format: formatNumber, axis: formatCompactNumber },
    revenue: { label: "Ingresos", color: "#1f8a5f", better: "up", format: money, axis: compactMoney, rightAxis: true },
    conversionRate: { label: "Tasa de conversión", short: "Conversión", color: "#e0445a", better: "up", format: (v) => formatPercent(v, 2), axis: pct },
    views: { label: "Vistas de página", short: "Vistas", color: "#64748b", better: "up", format: formatNumber, axis: formatCompactNumber },
    bounceRate: { label: "Tasa de rebote", short: "Rebote", color: "#d9534f", better: "down", format: pct, axis: pct },
  };
}

export const CARD_KEYS = [
  "users",
  "newUsers",
  "sessions",
  "engagementRate",
  "avgEngagementTime",
  "purchases",
  "revenue",
  "conversionRate",
];
export const EVOLUTION_KEYS = [
  "sessions",
  "users",
  "revenue",
  "newUsers",
  "purchases",
  "conversionRate",
  "engagementRate",
  "avgEngagementTime",
  "views",
  "bounceRate",
];
export const EVOLUTION_DEFAULT = ["sessions", "users", "revenue"];
