import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdsWithDetails } from "@/lib/meta";

// GET /api/meta/ads?campaignId=120251884316740202
// Devuelve los anuncios de la campana, con su creatividad (imagen/video,
// titulo, texto, URL de destino) y sus metricas propias (impresiones,
// clicks, gasto, acciones/conversiones).
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
    const data = await getAdsWithDetails(accessToken, campaignId);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message, details: err.details }, { status: 400 });
  }
}
