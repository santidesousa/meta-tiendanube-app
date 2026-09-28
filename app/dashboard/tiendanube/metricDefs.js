import { formatCompactMoney, formatCompactNumber, formatMoney, formatNumber, formatPercent } from "../format";

// Metricas de Tiendanube para las tarjetas y el grafico de evolucion
// (formato de cada definicion: ver app/dashboard/MetricCards.js).
export function metricDefs(currency) {
  const money = (v) => formatMoney(v, currency);
  const compactMoney = (v) => formatCompactMoney(v, currency);
  const pct = (v) => formatPercent(v, 1);
  return {
    revenue: { label: "Facturación", color: "#1f8a5f", better: "up", format: money, axis: compactMoney, kind: "bar" },
    paidCount: { label: "Pedidos pagados", short: "Pedidos", color: "#6366f1", better: "up", format: formatNumber, axis: formatCompactNumber, rightAxis: true },
    avgTicket: { label: "Ticket promedio", color: "#0f9f8f", better: "up", format: money, axis: compactMoney },
    units: { label: "Unidades vendidas", short: "Unidades", color: "#e8910c", better: "up", format: formatNumber, axis: formatCompactNumber },
    newCustomers: { label: "Clientes nuevos", color: "#2f80d1", better: "up", format: formatNumber, axis: formatCompactNumber },
    returningCustomers: { label: "Clientes recurrentes", short: "Recurrentes", color: "#9b5de5", better: "up", format: formatNumber, axis: formatCompactNumber },
    // Alternativas si no hay fecha de alta de clientes (ver page.js).
    customers: { label: "Clientes", color: "#2f80d1", better: "up", format: formatNumber, axis: formatCompactNumber },
    repeatCustomers: { label: "Recompraron", color: "#9b5de5", better: "up", format: formatNumber, axis: formatCompactNumber },
    conversionRate: { label: "Pedidos cobrados", color: "#64748b", better: "up", format: pct, axis: pct },
    cancelRate: { label: "Cancelaciones", color: "#e0445a", better: "down", format: pct, axis: pct },
  };
}

export const CARD_KEYS = [
  "revenue",
  "paidCount",
  "avgTicket",
  "units",
  "newCustomers",
  "returningCustomers",
  "conversionRate",
  "cancelRate",
];
export const EVOLUTION_KEYS = CARD_KEYS;
export const EVOLUTION_DEFAULT = ["revenue", "paidCount"];
