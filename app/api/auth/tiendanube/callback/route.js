import { NextResponse } from "next/server";
import { verifyStore } from "@/lib/tiendanube";
import { tokenErrorPage, tokenPage } from "@/lib/tokenPage";

// GET /api/auth/tiendanube/callback?code=...&state=...
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const savedState = request.cookies.get("tiendanube_oauth_state")?.value;
  if (!state || state !== savedState) {
    return NextResponse.json({ error: "state invalido (posible CSRF)" }, { status: 400 });
  }

  const clientId = process.env.TIENDANUBE_CLIENT_ID;
  const clientSecret = process.env.TIENDANUBE_CLIENT_SECRET;

  const tokenRes = await fetch("https://www.tiendanube.com/apps/authorize/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok) {
    return NextResponse.json({ error: "Error obteniendo token", details: tokenData }, { status: 400 });
  }

  // tokenData incluye: access_token, token_type, y user_id (id de la tienda).
  // El token de Tiendanube NO expira, asi que no hace falta refrescarlo.

  // Solo aceptamos la tienda de Tout Revient: si se autorizo otra (por estar
  // logueado en otro cliente), no mostramos su token.
  let check;
  try {
    check = await verifyStore(tokenData.user_id, tokenData.access_token);
  } catch (err) {
    return tokenErrorPage("No se pudo verificar la tienda", err.message);
  }
  if (!check.ok) {
    return tokenErrorPage(
      "Esta tienda no es Tout Revient",
      `Autorizaste la tienda "${check.store.name || check.store.id}". Cerrá sesión en Tiendanube, entrá con la cuenta de Tout Revient y volvé a abrir /api/auth/tiendanube.`
    );
  }

  // El token NO se guarda en cookies: se muestra para pegarlo en Vercel.
  const res = tokenPage({
    title: "Token de Tiendanube",
    intro: `Conectado a la tienda "${check.store.name}". Copiá estos dos valores a las Environment Variables de Vercel. El token de Tiendanube no vence.`,
    fields: [
      { name: "TIENDANUBE_ACCESS_TOKEN", label: "Access token", value: tokenData.access_token },
      { name: "TIENDANUBE_STORE_ID", label: "Store ID (user_id)", value: String(tokenData.user_id) },
    ],
  });
  for (const name of ["tiendanube_oauth_state", "tiendanube_access_token", "tiendanube_store_id"]) {
    res.headers.append("Set-Cookie", `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  }
  return res;
}
