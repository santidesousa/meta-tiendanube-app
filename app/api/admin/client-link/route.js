import { NextResponse } from "next/server";
import { clientLinkKey } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/admin/client-link  (solo agencia, ver middleware)
export async function GET(request) {
  const key = await clientLinkKey();
  if (!key) return NextResponse.json({ error: "Falta configurar las contraseñas" }, { status: 503 });
  return NextResponse.json({ url: new URL(`/acceso/${key}`, request.url).toString() });
}
