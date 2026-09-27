import { NextResponse } from "next/server";
import crypto from "crypto";

// GET /api/auth/tiendanube
// Redirige al usuario a la pantalla de autorizacion de Tiendanube.
export async function GET() {
  const clientId = process.env.TIENDANUBE_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: "Falta configurar TIENDANUBE_CLIENT_ID en .env.local" },
      { status: 500 }
    );
  }

  const state = crypto.randomBytes(16).toString("hex");

  const authUrl = new URL(`https://www.tiendanube.com/apps/${clientId}/authorize`);
  authUrl.searchParams.set("state", state);

  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set("tiendanube_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
    path: "/",
  });
  return res;
}
