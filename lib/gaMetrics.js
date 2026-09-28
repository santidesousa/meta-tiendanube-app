// Metricas de Google Analytics 4 para el panel. Funciones puras: se usan en
// el servidor (para devolver filas livianas) y en el cliente (ratios).

// Metricas que se piden a GA (la API acepta hasta 10 por reporte) y el
// nombre con el que las usa el panel.
export const GA_METRICS = {
  activeUsers: "users",
  newUsers: "newUsers",
  sessions: "sessions",
  engagedSessions: "engagedSessions",
  userEngagementDuration: "engagementSeconds",
  screenPageViews: "views",
  addToCarts: "addToCarts",
  checkouts: "checkouts",
  ecommercePurchases: "purchases",
  purchaseRevenue: "revenue",
};
export const GA_METRIC_NAMES = Object.keys(GA_METRICS);

// Para reportes por dimension (canales, fuentes, etc.) alcanza con estas.
export const GA_TABLE_METRICS = [
  "activeUsers",
  "newUsers",
  "sessions",
  "engagedSessions",
  "userEngagementDuration",
  "screenPageViews",
  "ecommercePurchases",
  "purchaseRevenue",
];

/** Fila de GA (nombres de la API) -> metricas del panel */
export function parseGaRow(row) {
  const out = {};
  for (const [api, key] of Object.entries(GA_METRICS)) {
    if (row[api] !== undefined) out[key] = row[api];
  }
  return out;
}

export function emptyGaMetrics() {
  return Object.fromEntries(Object.values(GA_METRICS).map((k) => [k, 0]));
}

/**
 * Suma filas. OJO: usuarios no es sumable entre dias (la misma persona
 * cuenta en varios); para totales exactos se piden a GA sin dimension.
 */
export function sumGaMetrics(list) {
  const total = emptyGaMetrics();
  for (const m of list) for (const k of Object.keys(total)) total[k] += m?.[k] || 0;
  return total;
}

/** Ratios: interaccion, tiempo medio, conversion, ticket promedio, etc. */
export function withGaRatios(m) {
  if (!m) return null;
  return {
    ...m,
    engagementRate: m.sessions ? m.engagedSessions / m.sessions : null,
    bounceRate: m.sessions ? 1 - m.engagedSessions / m.sessions : null,
    // Tiempo de interaccion medio por usuario activo (como en GA4), en segundos.
    avgEngagementTime: m.users ? m.engagementSeconds / m.users : null,
    viewsPerSession: m.sessions ? m.views / m.sessions : null,
    conversionRate: m.sessions ? m.purchases / m.sessions : null,
    aov: m.purchases ? m.revenue / m.purchases : null,
    newUserShare: m.users ? m.newUsers / m.users : null,
  };
}

/** 95 -> "1:35" */
export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || !isFinite(seconds)) return "—";
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
