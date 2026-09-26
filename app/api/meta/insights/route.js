import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCampaignInsights } from "@/lib/meta";

// GET /api/meta/insights?campaignId=120251884316740202
// Devuelve impresiones, clicks, gasto y CTR de la campana indicada.
export async function GET(request) {
  const accessToken = cookies().get("meta_access_token")?.value;

  if (!accessToken) {
    return NextResponse.json({ error: "No conectado con Meta todavia" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get("campaignId");

  if (!campaignId) {
    return NextResponse.json(
      { error: "Falta el parametro campaignId, ej: ?campaignId=120251884316740202" },
      { status: 400 }
    );
  }

  try {
    const data = await getCampaignInsights(accessToken, campaignId);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message, details: err.details }, { status: 400 });
  }
}
