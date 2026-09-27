import { NextResponse } from "next/server";
import { ALLOWED_AD_ACCOUNT_ID, getAdAccount } from "@/lib/meta";
import { tokenErrorPage, tokenPage } from "@/lib/tokenPage";

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

  const token = longLivedData.access_token || tokenData.access_token;
  const expiresIn = longLivedData.expires_in || tokenData.expires_in;

  // Chequeo: el token tiene que ver la cuenta de Tout Revient.
  let account = null;
  try {
    account = await getAdAccount(token, ALLOWED_AD_ACCOUNT_ID);
  } catch {
    return tokenErrorPage(
      "Este usuario no tiene acceso a Tout Revient",
      `El usuario de Facebook con el que conectaste no puede ver la cuenta publicitaria ${ALLOWED_AD_ACCOUNT_ID}. Conectá con un usuario que tenga acceso a esa cuenta.`
    );
  }

  const expires = expiresIn
    ? new Date(Date.now() + expiresIn * 1000).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  // El token NO se guarda en cookies: se muestra para pegarlo en Vercel.
  const res = tokenPage({
    title: "Token de Meta Ads",
    intro: `Conectado a la cuenta publicitaria "${account.name}" (${ALLOWED_AD_ACCOUNT_ID}). Copiá este valor a las Environment Variables de Vercel.`,
    fields: [{ name: "META_ACCESS_TOKEN", label: "Access token", value: token }],
    note: expires
      ? `Este token vence el <b>${expires}</b>. Antes de esa fecha, volvé a entrar a <code>/api/auth/meta</code> y actualizá la variable. Para no tener que renovarlo, se puede usar un token de <b>usuario del sistema</b> de Business Manager (no vence).`
      : undefined,
  });
  clearOldCookies(res, ["meta_oauth_state", "meta_access_token"]);
  return res;
}

// Borra cookies de versiones anteriores (antes el token vivia en cookies).
function clearOldCookies(res, names) {
  for (const name of names) {
    res.headers.append("Set-Cookie", `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  }
}
