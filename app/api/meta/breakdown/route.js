import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { errorResponse, httpError, requireMeta, requireRange } from "../../_shared/route-helpers";
import { ALLOWED_AD_ACCOUNT_ID, getAccountInsights } from "@/lib/meta";
import { parseInsight } from "@/lib/metaMetrics";

const GENDERS = { female: "Mujeres", male: "Hombres", unknown: "Sin dato" };
const PLATFORMS = {
  facebook: "Facebook",
  instagram: "Instagram",
  audience_network: "Audience Network",
  messenger: "Messenger",
  threads: "Threads",
};
const POSITIONS = {
  feed: "Feed",
  instagram_stories: "Stories",
  facebook_stories: "Stories",
  instagram_reels: "Reels",
  facebook_reels: "Reels",
  instagram_explore: "Explorar",
  instagram_explore_grid_home: "Explorar",
  instagram_profile_feed: "Perfil",
  marketplace: "Marketplace",
  video_feeds: "Videos",
  right_hand_column: "Columna derecha",
  search: "Búsqueda",
  an_classic: "Audience Network",
  messenger_inbox: "Messenger",
};
const DEVICES = {
  iphone: "iPhone",
  ipad: "iPad",
  android_smartphone: "Android",
  android_tablet: "Tablet Android",
  desktop: "Computadora",
  other: "Otro",
};

// Cada tipo de desglose: que breakdowns pedir y como etiquetar la fila.
// El desglose por hora no admite alcance/frecuencia.
const TYPES = {
  age_gender: {
    breakdowns: "age,gender",
    label: (r) => `${r.age} · ${GENDERS[r.gender] || r.gender}`,
    extra: (r) => ({ age: r.age, gender: r.gender }),
  },
  platform: {
    breakdowns: "publisher_platform",
    label: (r) => PLATFORMS[r.publisher_platform] || r.publisher_platform,
  },
  placement: {
    breakdowns: "publisher_platform,platform_position",
    label: (r) =>
      `${PLATFORMS[r.publisher_platform] || r.publisher_platform} · ${
        POSITIONS[r.platform_position] || r.platform_position
      }`,
  },
  region: { breakdowns: "region", label: (r) => r.region },
  device: {
    breakdowns: "impression_device",
    label: (r) => DEVICES[r.impression_device] || r.impression_device,
  },
  hourly: {
    breakdowns: "hourly_stats_aggregated_by_advertiser_time_zone",
    metrics: "spend,impressions,clicks,inline_link_clicks,actions,action_values",
    label: (r) => r.hourly_stats_aggregated_by_advertiser_time_zone.slice(0, 5),
    extra: (r) => ({ hour: parseInt(r.hourly_stats_aggregated_by_advertiser_time_zone, 10) }),
  },
};

// GET /api/meta/breakdown?type=age_gender&since=2026-09-01&until=2026-09-27
export async function GET(request) {
  try {
    const { token } = requireMeta();
    const range = requireRange(request);
    const typeKey = new URL(request.url).searchParams.get("type");
    const type = TYPES[typeKey];
    if (!type) throw httpError(`type invalido. Opciones: ${Object.keys(TYPES).join(", ")}`, 400, "bad_request");

    const { data, generatedAt } = await cached(
      "meta",
      ["breakdown", ALLOWED_AD_ACCOUNT_ID, typeKey, range.since, range.until],
      async () => {
        const rows = await getAccountInsights(token, ALLOWED_AD_ACCOUNT_ID, range, {
          breakdowns: type.breakdowns,
          ...(type.metrics ? { metrics: type.metrics } : {}),
        });
        return rows.map((r) => ({ label: type.label(r), ...(type.extra ? type.extra(r) : {}), ...parseInsight(r) }));
      }
    );
    return NextResponse.json({ rows: data, generatedAt });
  } catch (err) {
    return errorResponse(err);
  }
}
