import { NextResponse } from "next/server";
import { SESSION_COOKIE, readSessionValue } from "@/lib/session";

// Rutas sin login.
const PUBLIC = ["/login", "/api/login", "/api/logout", "/acceso"];

// Solo la agencia: conectar cuentas y ver tokens.
const ADMIN_ONLY = ["/api/auth", "/api/admin", "/dashboard/conexiones"];

function matches(pathname, prefixes) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request) {
  // Interruptor temporal: con TEMP_DISABLE_AUTH="true" el panel queda abierto
  // sin login. Cualquier otro valor (o sin definir) mantiene la proteccion.
  if (process.env.TEMP_DISABLE_AUTH === "true") return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (matches(pathname, PUBLIC)) return NextResponse.next();

  const session = await readSessionValue(request.cookies.get(SESSION_COOKIE)?.value);
  const isApi = pathname.startsWith("/api/");

  if (!session) {
    if (isApi) return NextResponse.json({ error: "Sesión vencida o inexistente", code: "unauthorized" }, { status: 401 });
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  if (matches(pathname, ADMIN_ONLY) && session.role !== "admin") {
    if (isApi) return NextResponse.json({ error: "Solo para la agencia", code: "forbidden" }, { status: 403 });
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (pathname === "/") return NextResponse.redirect(new URL("/dashboard", request.url));
  return NextResponse.next();
}

export const config = {
  // Todo menos los assets de Next y las imagenes publicas (el logo se ve
  // tambien en la pantalla de login, antes de iniciar sesion).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
