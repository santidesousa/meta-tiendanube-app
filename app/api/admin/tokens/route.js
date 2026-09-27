import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

// GET /api/admin/tokens  (solo agencia, ver middleware)
// Devuelve los tokens que el OAuth dejo en este navegador, para copiarlos a
// las variables de entorno de Vercel. Nunca devuelve los que ya estan en env.
export async function GET() {
  const c = cookies();
  return NextResponse.json({
    META_ACCESS_TOKEN: c.get("meta_access_token")?.value || null,
    TIENDANUBE_ACCESS_TOKEN: c.get("tiendanube_access_token")?.value || null,
    TIENDANUBE_STORE_ID: c.get("tiendanube_store_id")?.value || null,
  });
}
