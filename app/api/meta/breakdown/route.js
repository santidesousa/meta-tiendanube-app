import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ALLOWED_AD_ACCOUNT_ID, getAccountInsights } from "@/lib/meta";
import { parseInsight } from "@/lib/metaMetrics";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
  const accessToken = cookies().get("meta_access_token")?.value;
  if (!accessToken) {
    return NextResponse.json({ error: "No conectado con Meta todavia" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = TYPES[searchParams.get("type")];
  const since = searchParams.get("since");
  const until = searchParams.get("until");
  if (!type) {
    return NextResponse.json({ error: `type invalido. Opciones: ${Object.keys(TYPES).join(", ")}` }, { status: 400 });
  }
  if (!DATE_RE.test(since || "") || !DATE_RE.test(until || "")) {
    return NextResponse.json({ error: "Parametros since/until invalidos (YYYY-MM-DD)" }, { status: 400 });
  }

  try {
    const rows = await getAccountInsights(
      accessToken,
      ALLOWED_AD_ACCOUNT_ID,
      { since, until },
      { breakdowns: type.breakdowns, ...(type.metrics ? { metrics: type.metrics } : {}) }
    );
    return NextResponse.json(
      rows.map((r) => ({ label: type.label(r), ...(type.extra ? type.extra(r) : {}), ...parseInsight(r) }))
    );
  } catch (err) {
    return NextResponse.json({ error: err.message, details: err.details }, { status: 400 });
  }
}
