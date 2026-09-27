import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ALLOWED_AD_ACCOUNT_ID, getAdAccounts } from "@/lib/meta";

// GET /api/meta/ad-accounts
// Ejemplo: usa el token guardado en la cookie para listar cuentas publicitarias.
export async function GET() {
  const accessToken = cookies().get("meta_access_token")?.value;

  if (!accessToken) {
    return NextResponse.json({ error: "No conectado con Meta todavia" }, { status: 401 });
  }

  try {
    // Solo la cuenta de Tout Revient: el token de la agencia ve cuentas de otros clientes.
    const data = await getAdAccounts(accessToken);
    return NextResponse.json({ data: (data.data || []).filter((a) => a.id === ALLOWED_AD_ACCOUNT_ID) });
  } catch (err) {
    return NextResponse.json({ error: err.message, details: err.details }, { status: 400 });
  }
}
