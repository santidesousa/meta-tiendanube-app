import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  authConfigured,
  createSessionValue,
  roleForPassword,
} from "@/lib/session";

// POST /api/login  { password }
export async function POST(request) {
  if (!authConfigured()) {
    return NextResponse.json(
      { error: "El panel todavía no tiene contraseña. Configurá ADMIN_PASSWORD y DASHBOARD_PASSWORD en Vercel." },
      { status: 503 }
    );
  }

  const { password } = await request.json().catch(() => ({}));
  const role = roleForPassword(password);
  if (!role) {
    // Pequena demora para que probar contrasenas por fuerza bruta sea lento.
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(SESSION_COOKIE, await createSessionValue(role), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DAYS * 86400,
    path: "/",
  });
  return res;
}
