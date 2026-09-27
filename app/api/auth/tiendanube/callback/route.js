import { NextResponse } from "next/server";

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
  const res = NextResponse.redirect(new URL("/dashboard?connected=tiendanube", process.env.APP_URL));
  res.cookies.delete("tiendanube_oauth_state");
  res.cookies.set("tiendanube_access_token", tokenData.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  res.cookies.set("tiendanube_store_id", String(tokenData.user_id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  return res;
}
