import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { errorResponse, requireMeta, requireRange } from "../../_shared/route-helpers";
import {
  AD_CREATIVE_FIELDS,
  ALLOWED_AD_ACCOUNT_ID,
  getActiveAds,
  getAllAdsets,
  getAccountInsights,
  getAdAccount,
  getAllCampaigns,
  getObjectsByIds,
} from "@/lib/meta";
import { parseInsight } from "@/lib/metaMetrics";
import { classifyObjective, dominantType } from "@/lib/metaObjectives";
import { previousRange } from "@/lib/dateRange";

// La mejor imagen disponible de la creatividad: imagen original, portada
// del video, imagen del link, y por ultimo la miniatura (baja resolucion).
function creativeImage(c) {
  if (!c) return null;
  const spec = c.object_story_spec || {};
  return (
    c.image_url ||
    spec.video_data?.image_url ||
    spec.link_data?.picture ||
    c.thumbnail_url ||
    null
  );
}

function creativeText(c) {
  const spec = c?.object_story_spec || {};
  return {
    title: c?.title || spec.link_data?.name || spec.video_data?.title || null,
    body: c?.body || spec.link_data?.message || spec.video_data?.message || null,
    link: c?.object_url || c?.link_url || spec.link_data?.link || spec.video_data?.call_to_action?.value?.link || null,
    isVideo: Boolean(c?.video_id || spec.video_data),
  };
}

// GET /api/meta/overview?since=2026-09-01&until=2026-09-27
// Todo lo que necesita la pagina de Meta Ads en una sola respuesta: cuenta,
// totales (periodo actual y anterior), serie diaria, campanas y anuncios con
// creatividad. La cuenta es siempre la de Tout Revient.
export async function GET(request) {
  try {
    const { token } = requireMeta();
    const range = requireRange(request);
    const { data, generatedAt } = await cached("meta", ["overview-v3", ALLOWED_AD_ACCOUNT_ID, range.since, range.until], () =>
      buildOverview(token, range)
    );
    return NextResponse.json({ ...data, generatedAt });
  } catch (err) {
    return errorResponse(err);
  }
}

async function buildOverview(accessToken, range) {
  const accountId = ALLOWED_AD_ACCOUNT_ID;
  const prev = previousRange(range);

  const [account, totals, previous, daily, weekly, campaigns, campaignRows, adRows, activeAds, adsets] = await Promise.all([
    getAdAccount(accessToken, accountId),
    getAccountInsights(accessToken, accountId, range),
    getAccountInsights(accessToken, accountId, prev),
    getAccountInsights(accessToken, accountId, range, { time_increment: "1" }),
    // Agrupado por semana directamente en Meta (bloques de 7 dias desde `since`).
    getAccountInsights(accessToken, accountId, range, { level: "account", time_increment: "7" }),
    getAllCampaigns(accessToken, accountId),
    getAccountInsights(accessToken, accountId, range, { level: "campaign", fields: "campaign_id" }),
    getAccountInsights(accessToken, accountId, range, {
      level: "ad",
      fields: "ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name",
    }),
    // Si falla, seguimos sin el listado de activos antes que romper el panel.
    getActiveAds(accessToken, accountId).catch((err) => {
      console.error("No se pudieron traer los anuncios activos", err.message);
      return null;
    }),
    // Para medir cada anuncio segun su objetivo. Si falla, se usa solo el
    // objetivo de la campana.
    getAllAdsets(accessToken, accountId).catch((err) => {
      console.error("No se pudieron traer los conjuntos de anuncios", err.message);
      return [];
    }),
  ]);

  // Tipo de objetivo por conjunto y por campana (la campana toma el tipo
  // mas comun de sus conjuntos; sin conjuntos, su propio objetivo).
  const campaignObjective = Object.fromEntries(campaigns.map((c) => [c.id, c.objective]));
  const adsetType = Object.fromEntries(
    adsets.map((a) => [
      a.id,
      classifyObjective({
        objective: campaignObjective[a.campaign_id],
        optimizationGoal: a.optimization_goal,
        promotedObject: a.promoted_object,
      }),
    ])
  );
  const campaignType = {};
  for (const c of campaigns) {
    const types = adsets.filter((a) => a.campaign_id === c.id).map((a) => adsetType[a.id]);
    campaignType[c.id] = dominantType(types) || classifyObjective({ objective: c.objective });
  }
  const adType = (adsetId, campaignId) => adsetType[adsetId] || campaignType[campaignId] || "other";

  const activeById = Object.fromEntries((activeAds || []).map((a) => [a.id, a]));

  // Creatividad y estado de los anuncios con actividad en el periodo. Si
  // falla, seguimos sin imagenes antes que romper todo el panel.
  let adObjects = {};
  try {
    // Los activos ya vienen con creatividad: solo pedimos el resto.
    adObjects = await getObjectsByIds(
      accessToken,
      adRows.map((r) => r.ad_id).filter((id) => !activeById[id]),
      `effective_status,${AD_CREATIVE_FIELDS}`
    );
  } catch (err) {
    console.error("No se pudieron traer las creatividades", err.message);
  }

  const campaignMetrics = Object.fromEntries(campaignRows.map((r) => [r.campaign_id, parseInsight(r)]));

  return {
    account: {
      id: accountId,
      name: account.name,
      currency: account.currency,
      timezone: account.timezone_name,
    },
    range,
    previousRange: prev,
    totals: parseInsight(totals[0]) || parseInsight({}),
    previous: previous[0] ? parseInsight(previous[0]) : null,
    daily: daily.map((r) => ({ day: r.date_start, ...parseInsight(r) })),
    weekly: weekly.map((r) => ({ day: r.date_start, until: r.date_stop, ...parseInsight(r) })),
    activeAdsAvailable: activeAds !== null,
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.effective_status || c.status,
      objective: c.objective,
      objectiveType: campaignType[c.id],
      dailyBudget: c.daily_budget ? parseFloat(c.daily_budget) / 100 : null,
      lifetimeBudget: c.lifetime_budget ? parseFloat(c.lifetime_budget) / 100 : null,
      metrics: campaignMetrics[c.id] || null,
    })),
    ads: [
      ...adRows.map((r) => {
        const obj = activeById[r.ad_id] || adObjects[r.ad_id] || {};
        return {
          id: r.ad_id,
          name: r.ad_name,
          adsetName: r.adset_name,
          campaignId: r.campaign_id,
          campaignName: r.campaign_name,
          objectiveType: adType(r.adset_id, r.campaign_id),
          status: obj.effective_status || null,
          image: creativeImage(obj.creative),
          ...creativeText(obj.creative),
          metrics: parseInsight(r),
        };
      }),
      // Activos sin actividad en el periodo: se listan con metricas en cero
      // para que el filtro "Activos" muestre todo lo que esta circulando.
      ...(activeAds || [])
        .filter((a) => !adRows.some((r) => r.ad_id === a.id))
        .map((a) => ({
          id: a.id,
          name: a.name,
          adsetName: a.adset?.name || null,
          campaignId: a.campaign?.id || null,
          campaignName: a.campaign?.name || null,
          objectiveType: adType(a.adset?.id, a.campaign?.id),
          status: a.effective_status,
          image: creativeImage(a.creative),
          ...creativeText(a.creative),
          metrics: parseInsight({}),
        })),
    ],
  };
}
