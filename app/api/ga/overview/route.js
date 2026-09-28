import { NextResponse } from "next/server";
import { getRealtimeUsers, runReport } from "@/lib/googleAnalytics";
import { GA_METRIC_NAMES, GA_TABLE_METRICS, parseGaRow } from "@/lib/gaMetrics";
import { gaLabel } from "@/lib/gaLabels";
import { addDays, previousRange } from "@/lib/dateRange";
import { cached } from "@/lib/cache";
import { errorResponse, requireGa, requireRange } from "../../_shared/route-helpers";

// "20260901" -> "2026-09-01"
function gaDate(v) {
  return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
}

async function buildOverview(creds, range) {
  const prev = previousRange(range);
  const [totals, daily, weekly, channels, realtime] = await Promise.all([
    // Periodo actual y anterior en una sola consulta (GA agrega la
    // dimension "dateRange": date_range_0 / date_range_1).
    runReport(creds, { dateRanges: [range, prev], metrics: GA_METRIC_NAMES }),
    runReport(creds, { dateRanges: [range], dimensions: ["date"], metrics: GA_METRIC_NAMES, orderBy: "date", desc: false }),
    // nthWeek = bloques de 7 dias desde la fecha "desde" (igual que Meta).
    runReport(creds, { dateRanges: [range], dimensions: ["nthWeek"], metrics: GA_METRIC_NAMES, orderBy: "nthWeek", desc: false }),
    runReport(creds, {
      dateRanges: [range],
      dimensions: ["sessionDefaultChannelGroup"],
      metrics: GA_TABLE_METRICS,
      orderBy: "sessions",
    }),
    // Opcional: si falla (permisos, cuota), seguimos sin el dato en vivo.
    getRealtimeUsers(creds).catch(() => null),
  ]);

  const byRange = Object.fromEntries(totals.rows.map((r) => [r.dateRange, parseGaRow(r)]));
  return {
    propertyId: creds.propertyId,
    currency: totals.currency || daily.currency || "ARS",
    range,
    previousRange: prev,
    totals: byRange.date_range_0 || null,
    previous: byRange.date_range_1 || null,
    daily: daily.rows.map((r) => ({ day: gaDate(r.date), ...parseGaRow(r) })),
    weekly: weekly.rows.map((r) => {
      const n = parseInt(r.nthWeek, 10);
      const start = addDays(range.since, 7 * n);
      const end = addDays(start, 6);
      return { day: start, until: end > range.until ? range.until : end, ...parseGaRow(r) };
    }),
    channels: channels.rows.map((r) => ({ label: gaLabel("sessionDefaultChannelGroup", r.sessionDefaultChannelGroup), ...parseGaRow(r) })),
    realtimeUsers: realtime,
  };
}

// GET /api/ga/overview?since=2026-09-01&until=2026-09-27
// Resumen de Google Analytics 4 de Tout Revient para el periodo.
export async function GET(request) {
  try {
    const creds = requireGa();
    const range = requireRange(request);
    const { data, generatedAt } = await cached("ga", ["overview", creds.propertyId, range.since, range.until], () =>
      buildOverview(creds, range)
    );
    return NextResponse.json({ ...data, generatedAt });
  } catch (err) {
    return errorResponse(err);
  }
}
