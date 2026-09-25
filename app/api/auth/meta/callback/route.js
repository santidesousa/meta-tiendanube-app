import { NextResponse } from "next/server";

// GET /api/auth/meta/callback?code=...&state=...
// Meta redirige aca despues de que el usuario acepta los permisos.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  if (errorParam) {
    return NextResponse.json({ error: errorParam }, { status: 400 });
  }

  const savedState = request.cookies.get("meta_oauth_state")?.value;
  if (!state || state !== savedState) {
    return NextResponse.json({ error: "state invalido (posible CSRF)" }, { status: 400 });
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = process.env.META_REDIRECT_URI;

  // 1) Intercambiar el "code" por un access token de corta duracion
  const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);

  const tokenRes = await fetch(tokenUrl.toString());
  const tokenData = await tokenRes.json();

  if (!tokenRes.ok) {
    return NextResponse.json({ error: "Error obteniendo token", details: tokenData }, { status: 400 });
  }

  // 2) Cambiar el token de corta duracion por uno de larga duracion (~60 dias)
  const longLivedUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
  longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
  longLivedUrl.searchParams.set("client_id", appId);
  longLivedUrl.searchParams.set("client_secret", appSecret);
  longLivedUrl.searchParams.set("fb_exchange_token", tokenData.access_token);

  const longLivedRes = await fetch(longLivedUrl.toString());
  const longLivedData = await longLivedRes.json();

  // ATENCION: esto es solo un ejemplo. En produccion NUNCA guardes el
  // access_token en una cookie visible al cliente ni en localStorage.
  // Guardalo cifrado en tu base de datos, asociado al usuario, y
  // devolvele al cliente solo un ID de sesion.
  const res = NextResponse.redirect(new URL("/dashboard?connected=meta", process.env.APP_URL));
  res.cookies.delete("meta_oauth_state");
  res.cookies.set("meta_access_token", longLivedData.access_token || tokenData.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 55, // ~55 dias
    path: "/",
  });

  return res;
}
