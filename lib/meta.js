const GRAPH_API_VERSION = "v21.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// Este panel es exclusivo de Tout Revient. El token de Meta es de la agencia
// (con acceso a varias cuentas), asi que el servidor solo acepta esta cuenta.
export const ALLOWED_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || "act_1487373418081023";

/**
 * Llama a un endpoint de la Graph API de Meta con el access token del usuario.
 * @param {string} path - ej: "/me/adaccounts"
 * @param {string} accessToken
 * @param {Record<string,string>} params - query params adicionales
 */
export async function metaFetch(path, accessToken, params = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("access_token", accessToken);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString());
  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data?.error?.message || "Error en Meta Graph API");
    err.details = data;
    throw err;
  }
  return data;
}

/**
 * Como metaFetch, pero sigue paging.next y devuelve todas las filas de data.
 */
export async function metaFetchAll(path, accessToken, params = {}, maxPages = 10) {
  let page = await metaFetch(path, accessToken, params);
  const rows = [...(page.data || [])];
  for (let i = 1; i < maxPages && page.paging?.next; i++) {
    const res = await fetch(page.paging.next);
    page = await res.json();
    if (!res.ok) {
      const err = new Error(page?.error?.message || "Error en Meta Graph API");
      err.details = page;
      throw err;
    }
    rows.push(...(page.data || []));
  }
  return rows;
}

/** Nombre, moneda y zona horaria de la cuenta publicitaria */
export function getAdAccount(accessToken, adAccountId) {
  return metaFetch(`/${adAccountId}`, accessToken, {
    fields: "name,currency,timezone_name,account_status",
  });
}

export const INSIGHT_METRICS =
  "spend,impressions,reach,frequency,clicks,inline_link_clicks,actions,action_values";

/**
 * Insights de la cuenta con time_range. `options` admite level
 * (campaign/ad), breakdowns, time_increment y fields extra.
 */
export function getAccountInsights(accessToken, adAccountId, dateRange, options = {}) {
  const { fields, metrics = INSIGHT_METRICS, ...rest } = options;
  return metaFetchAll(`/${adAccountId}/insights`, accessToken, {
    fields: fields ? `${fields},${metrics}` : metrics,
    time_range: timeRangeJSON(dateRange),
    limit: "500",
    ...rest,
  });
}

/** Todas las campanas de la cuenta (con estado efectivo) */
export function getAllCampaigns(accessToken, adAccountId) {
  return metaFetchAll(`/${adAccountId}/campaigns`, accessToken, {
    fields: "id,name,status,effective_status,objective,daily_budget,lifetime_budget",
    limit: "200",
  });
}

/** Lee varios objetos por id (de a 50, el maximo de la Graph API) */
export async function getObjectsByIds(accessToken, ids, fields) {
  const result = {};
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const data = await metaFetch("/", accessToken, { ids: batch.join(","), fields });
    Object.assign(result, data);
  }
  return result;
}

/** true si la campana pertenece a la cuenta permitida */
export async function isAllowedCampaign(accessToken, campaignId) {
  const data = await metaFetch(`/${campaignId}`, accessToken, { fields: "account_id" });
  return `act_${data.account_id}` === ALLOWED_AD_ACCOUNT_ID;
}

/** Lista las cuentas publicitarias a las que el usuario tiene acceso */
export function getAdAccounts(accessToken) {
  return metaFetch("/me/adaccounts", accessToken, {
    fields: "id,name,account_status,currency,business",
  });
}

/** Lista las campanas de una cuenta publicitaria (act_<id>) */
export function getCampaigns(accessToken, adAccountId) {
  return metaFetch(`/${adAccountId}/campaigns`, accessToken, {
    fields: "id,name,status,objective,daily_budget,lifetime_budget",
  });
}

/**
 * Rango de fechas en el formato que espera la Graph API:
 * {"since":"YYYY-MM-DD","until":"YYYY-MM-DD"}
 */
function timeRangeJSON(dateRange) {
  return JSON.stringify({ since: dateRange.since, until: dateRange.until });
}

/**
 * Metricas basicas de una campana (impresiones, clicks, gasto, compras).
 * @param {{since: string, until: string}} [dateRange]
 */
export function getCampaignInsights(accessToken, campaignId, dateRange) {
  const params = {
    fields: "impressions,clicks,spend,cpc,ctr,actions,action_values",
  };
  if (dateRange) params.time_range = timeRangeJSON(dateRange);
  return metaFetch(`/${campaignId}/insights`, accessToken, params);
}

/**
 * Lista los anuncios (ads) de una campana, con su creatividad
 * (imagen/video, texto, URL de destino) y sus metricas propias.
 * Si se pasa dateRange, las metricas se calculan para ese periodo.
 * @param {{since: string, until: string}} [dateRange]
 */
export function getAdsWithDetails(accessToken, campaignId, dateRange) {
  const insightsFields = "impressions,clicks,spend,ctr,cpc,actions,action_values";
  const insights = dateRange
    ? `insights.time_range(${timeRangeJSON(dateRange)}){${insightsFields}}`
    : `insights{${insightsFields}}`;
  return metaFetch(`/${campaignId}/ads`, accessToken, {
    fields: `id,name,status,creative{id,name,title,body,image_url,thumbnail_url,object_url,video_id,link_url},${insights}`,
    limit: "100",
  });
}
