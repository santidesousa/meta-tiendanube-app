import { NextResponse } from "next/server";
import {
  NOT_CONNECTED_META,
  NOT_CONNECTED_TIENDANUBE,
  getMetaCredentials,
  getTiendanubeCredentials,
} from "@/lib/credentials";
import { verifyStore, wrongStoreMessage } from "@/lib/tiendanube";

// Helpers compartidos por las rutas de /api (la carpeta _shared no es ruta).

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function httpError(message, status, code) {
  return Object.assign(new Error(message), { status, code });
}

export function errorResponse(err) {
  return NextResponse.json(
    { error: err.message, code: err.code, details: err.details, store: err.store },
    { status: err.status || 400 }
  );
}

/** { since, until } validados desde la query, o error 400 */
export function requireRange(request) {
  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since");
  const until = searchParams.get("until");
  if (!DATE_RE.test(since || "") || !DATE_RE.test(until || "")) {
    throw httpError("Parametros since/until invalidos (YYYY-MM-DD)", 400, "bad_request");
  }
  return { since, until };
}

export function requireMeta() {
  const creds = getMetaCredentials();
  if (!creds) throw httpError(NOT_CONNECTED_META, 401, "not_connected");
  return creds;
}

export function requireTiendanube() {
  const creds = getTiendanubeCredentials();
  if (!creds) throw httpError(NOT_CONNECTED_TIENDANUBE, 401, "not_connected");
  return creds;
}

/** Verifica que la tienda sea Tout Revient; si no, lanza 403 */
export async function assertAllowedStore(creds) {
  const { ok, store } = await verifyStore(creds.storeId, creds.token);
  if (!ok) throw Object.assign(httpError(wrongStoreMessage(store), 403, "wrong_store"), { store });
  return store;
}
