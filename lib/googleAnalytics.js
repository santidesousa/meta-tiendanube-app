import crypto from "crypto";

// Cliente minimo de la Google Analytics Data API (GA4), autenticado con una
// cuenta de servicio (no vence, no requiere que nadie "conecte" nada).
// Credenciales: GA_PROPERTY_ID y GA_SERVICE_ACCOUNT_JSON (ver credentials.js).

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_BASE = "https://analyticsdata.googleapis.com/v1beta";
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// El access token dura 1 hora: lo reutilizamos mientras la funcion siga viva.
let cachedToken = null;

async function getAccessToken({ clientEmail, privateKey }) {
  if (cachedToken && cachedToken.email === clientEmail && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.token;
  }
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({ iss: clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 })
  );
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(`${header}.${claims}`)
    .sign(privateKey, "base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(`Google rechazó la cuenta de servicio: ${data.error_description || data.error}`);
    err.details = data;
    throw err;
  }
  cachedToken = { token: data.access_token, email: clientEmail, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function gaPost(creds, path, body) {
  const token = await getAccessToken(creds);
  const res = await fetch(`${API_BASE}/properties/${creds.propertyId}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || "Error en Google Analytics";
    const err = new Error(
      res.status === 403
        ? `La cuenta de servicio no tiene acceso a la propiedad ${creds.propertyId}. Agregala como Lector en GA4 (Administrar → Acceso a la propiedad).`
        : msg
    );
    err.details = data;
    throw err;
  }
  return data;
}

/**
 * Corre un reporte y devuelve filas como objetos planos:
 * { [dimension]: string, [metrica]: number }, mas la moneda de la propiedad.
 * @param {object} p
 * @param {{since: string, until: string}[]} p.dateRanges
 * @param {string[]} [p.dimensions]
 * @param {string[]} p.metrics - maximo 10 por reporte (limite de la API)
 */
export async function runReport(creds, { dateRanges, dimensions = [], metrics, orderBy, limit = 1000, desc = true }) {
  const body = {
    dateRanges: dateRanges.map((r) => ({ startDate: r.since, endDate: r.until })),
    dimensions: dimensions.map((name) => ({ name })),
    metrics: metrics.map((name) => ({ name })),
    limit,
    keepEmptyRows: false,
  };
  if (orderBy) {
    body.orderBys = [
      metrics.includes(orderBy)
        ? { metric: { metricName: orderBy }, desc }
        : { dimension: { dimensionName: orderBy }, desc },
    ];
  }
  const data = await gaPost(creds, ":runReport", body);
  const dimNames = (data.dimensionHeaders || []).map((h) => h.name);
  const metricNames = (data.metricHeaders || []).map((h) => h.name);
  const rows = (data.rows || []).map((row) => {
    const out = {};
    dimNames.forEach((name, i) => (out[name] = row.dimensionValues[i].value));
    metricNames.forEach((name, i) => (out[name] = parseFloat(row.metricValues[i].value) || 0));
    return out;
  });
  return { rows, currency: data.metadata?.currencyCode || null };
}

/** Usuarios activos en los ultimos 30 minutos */
export async function getRealtimeUsers(creds) {
  const data = await gaPost(creds, ":runRealtimeReport", { metrics: [{ name: "activeUsers" }] });
  return parseInt(data.rows?.[0]?.metricValues?.[0]?.value || "0", 10);
}
