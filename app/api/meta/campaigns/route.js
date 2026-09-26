import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCampaigns } from "@/lib/meta";

// GET /api/meta/campaigns?accountId=act_123456789
// Devuelve las campañas de la cuenta publicitaria indicada.
export async function GET(request) {
  const accessToken = cookies().get("meta_access_token")?.value;

  if (!accessToken) {
    return NextResponse.json({ error: "No conectado con Meta todavia" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");

  if (!accountId) {
    return NextResponse.json(
      { error: "Falta el parametro accountId, ej: ?accountId=act_123456789" },
      { status: 400 }
    );
  }

  try {
    const data = await getCampaigns(accessToken, accountId);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message, details: err.details }, { status: 400 });
  }
}
