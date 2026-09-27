import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAllOrders } from "@/lib/tiendanube";

// GET /api/tiendanube/orders?since=2026-09-01&until=2026-09-27
// Devuelve todos los pedidos creados en ese rango (fechas en hora de Argentina).
export async function GET(request) {
  const accessToken = cookies().get("tiendanube_access_token")?.value;
  const storeId = cookies().get("tiendanube_store_id")?.value;

  if (!accessToken || !storeId) {
    return NextResponse.json({ error: "No conectado con Tiendanube todavia" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since");
  const until = searchParams.get("until");

  const filters = {};
  if (since) filters.created_at_min = `${since}T00:00:00-03:00`;
  if (until) filters.created_at_max = `${until}T23:59:59-03:00`;

  try {
    const data = await getAllOrders(storeId, accessToken, filters);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message, details: err.details }, { status: 400 });
  }
}
