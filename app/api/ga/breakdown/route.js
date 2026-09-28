import { NextResponse } from "next/server";
import { runReport } from "@/lib/googleAnalytics";
import { GA_TABLE_METRICS, parseGaRow } from "@/lib/gaMetrics";
import { gaLabel } from "@/lib/gaLabels";
import { cached } from "@/lib/cache";
import { errorResponse, httpError, requireGa, requireRange } from "../../_shared/route-helpers";

// Cada tipo: dimensiones a pedir, metrica para ordenar y como armar la fila.
const TYPES = {
  source: { dimensions: ["sessionSourceMedium"], orderBy: "sessions" },
  campaign: { dimensions: ["sessionCampaignName"], orderBy: "sessions" },
  landing: { dimensions: ["landingPage"], orderBy: "sessions" },
  pages: { dimensions: ["pageTitle", "pagePath"], orderBy: "screenPageViews" },
  device: { dimensions: ["deviceCategory"], orderBy: "sessions" },
  region: { dimensions: ["region"], orderBy: "sessions" },
  // Metricas de producto (item-scoped): no se pueden mezclar con las de sesion.
  products: {
    dimensions: ["itemName"],
    metrics: ["itemsViewed", "itemsAddedToCart", "itemsPurchased", "itemRevenue"],
    orderBy: "itemRevenue",
    row: (r) => ({
      label: gaLabel("itemName", r.itemName),
      itemsViewed: r.itemsViewed,
      itemsAddedToCart: r.itemsAddedToCart,
      itemsPurchased: r.itemsPurchased,
      itemRevenue: r.itemRevenue,
    }),
  },
};

// GET /api/ga/breakdown?type=source&since=2026-09-01&until=2026-09-27
export async function GET(request) {
  try {
    const creds = requireGa();
    const range = requireRange(request);
    const typeKey = new URL(request.url).searchParams.get("type");
    const type = TYPES[typeKey];
    if (!type) throw httpError(`type invalido. Opciones: ${Object.keys(TYPES).join(", ")}`, 400, "bad_request");

    const { data, generatedAt } = await cached("ga", ["breakdown", creds.propertyId, typeKey, range.since, range.until], async () => {
      const { rows } = await runReport(creds, {
        dateRanges: [range],
        dimensions: type.dimensions,
        metrics: type.metrics || GA_TABLE_METRICS,
        orderBy: type.orderBy,
        limit: 50,
      });
      return rows.map((r) =>
        type.row
          ? type.row(r)
          : {
              label: gaLabel(type.dimensions[0], r[type.dimensions[0]]),
              sub: type.dimensions[1] ? r[type.dimensions[1]] : null,
              ...parseGaRow(r),
            }
      );
    });
    return NextResponse.json({ rows: data, generatedAt });
  } catch (err) {
    return errorResponse(err);
  }
}
