const GRAPH_API_VERSION = "v21.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

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
