import { NextResponse } from "next/server";
import crypto from "crypto";

// GET /api/auth/meta
// Redirige al usuario a la pantalla de login/permisos de Meta.
export async function GET() {
  const appId = process.env.META_APP_ID;
  const redirectUri = process.env.META_REDIRECT_URI;
  const scopes = process.env.META_SCOPES || "ads_management,ads_read,business_management";

  if (!appId || !redirectUri) {
    return NextResponse.json(
      { error: "Falta configurar META_APP_ID o META_REDIRECT_URI en .env.local" },
      { status: 500 }
    );
  }

  // state evita ataques CSRF en el callback. En produccion, guardalo
  // en una cookie firmada o sesion y comparalo al volver.
  const state = crypto.randomBytes(16).toString("hex");

  const authUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("response_type", "code");

  const res = NextResponse.redirect(authUrl.toString());
  // Cookie temporal solo para validar el state en el callback
  res.cookies.set("meta_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
    path: "/",
  });
  return res;
}
