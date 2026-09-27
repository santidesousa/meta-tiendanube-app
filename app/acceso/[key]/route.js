import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  createSessionValue,
  isValidClientLinkKey,
} from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /acceso/<clave> — link de acceso directo para el cliente: abre una
// sesion de solo lectura sin pedir contrasena y lleva al Resumen.
export async function GET(request, { params }) {
  if (!(await isValidClientLinkKey(params.key))) {
    return NextResponse.redirect(new URL("/login?link=invalido", request.url));
  }
  const res = NextResponse.redirect(new URL("/dashboard", request.url));
  res.cookies.set(SESSION_COOKIE, await createSessionValue("client"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DAYS * 86400,
    path: "/",
  });
  return res;
}
