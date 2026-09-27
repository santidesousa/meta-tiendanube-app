import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { errorResponse, requireMeta, requireRange } from "../../_shared/route-helpers";
import {
  ALLOWED_AD_ACCOUNT_ID,
  getAccountInsights,
  getAdAccount,
  getAllCampaigns,
  getObjectsByIds,
} from "@/lib/meta";
import { parseInsight } from "@/lib/metaMetrics";
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
    const { data, generatedAt } = await cached("meta", ["overview", ALLOWED_AD_ACCOUNT_ID, range.since, range.until], () =>
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

  const [account, totals, previous, daily, campaigns, campaignRows, adRows] = await Promise.all([
    getAdAccount(accessToken, accountId),
    getAccountInsights(accessToken, accountId, range),
    getAccountInsights(accessToken, accountId, prev),
    getAccountInsights(accessToken, accountId, range, { time_increment: "1" }),
    getAllCampaigns(accessToken, accountId),
    getAccountInsights(accessToken, accountId, range, { level: "campaign", fields: "campaign_id" }),
    getAccountInsights(accessToken, accountId, range, {
      level: "ad",
      fields: "ad_id,ad_name,adset_name,campaign_id,campaign_name",
    }),
  ]);

  // Creatividad y estado de los anuncios con actividad en el periodo. Si
  // falla, seguimos sin imagenes antes que romper todo el panel.
  let adObjects = {};
  try {
    adObjects = await getObjectsByIds(
      accessToken,
      adRows.map((r) => r.ad_id),
      "effective_status,creative{title,body,image_url,thumbnail_url,object_url,link_url,video_id,object_story_spec}"
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
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.effective_status || c.status,
      objective: c.objective,
      dailyBudget: c.daily_budget ? parseFloat(c.daily_budget) / 100 : null,
      lifetimeBudget: c.lifetime_budget ? parseFloat(c.lifetime_budget) / 100 : null,
      metrics: campaignMetrics[c.id] || null,
    })),
    ads: adRows.map((r) => {
      const obj = adObjects[r.ad_id] || {};
      return {
        id: r.ad_id,
        name: r.ad_name,
        adsetName: r.adset_name,
        campaignId: r.campaign_id,
        campaignName: r.campaign_name,
        status: obj.effective_status || null,
        image: creativeImage(obj.creative),
        ...creativeText(obj.creative),
        metrics: parseInsight(r),
      };
    }),
  };
}
