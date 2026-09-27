import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOrders } from "@/lib/tiendanube";

// GET /api/tiendanube/orders
export async function GET() {
  const accessToken = cookies().get("tiendanube_access_token")?.value;
  const storeId = cookies().get("tiendanube_store_id")?.value;

  if (!accessToken || !storeId) {
    return NextResponse.json({ error: "No conectado con Tiendanube todavia" }, { status: 401 });
  }

  try {
    const data = await getOrders(storeId, accessToken, "?per_page=20");
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message, details: err.details }, { status: 400 });
  }
}
