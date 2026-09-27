// Sesion del panel: cookie firmada con HMAC-SHA256 (Web Crypto, asi que
// funciona tanto en el middleware (Edge) como en rutas de Node).
//
// Roles:
//   - "admin":   la agencia. Ve todo y puede conectar/reconectar cuentas.
//   - "client":  Tout Revient. Solo lectura.

export const SESSION_COOKIE = "tr_session";
export const SESSION_DAYS = 30;

const encoder = new TextEncoder();

function base64url(buffer) {
  let binary = "";
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** true si hay al menos una contrasena configurada */
export function authConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD || process.env.DASHBOARD_PASSWORD);
}

// Si no hay SESSION_SECRET, derivamos uno de las contrasenas: cambiar una
// contrasena invalida todas las sesiones abiertas, que es lo deseable.
function secret() {
  return (
    process.env.SESSION_SECRET ||
    `tr:${process.env.ADMIN_PASSWORD || ""}:${process.env.DASHBOARD_PASSWORD || ""}`
  );
}

async function sign(data) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return base64url(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
}

// Comparacion en tiempo constante para no filtrar informacion por timing.
export function safeEqual(a, b) {
  const x = encoder.encode(String(a));
  const y = encoder.encode(String(b));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

export async function createSessionValue(role) {
  const expires = Date.now() + SESSION_DAYS * 86400000;
  const payload = `${role}.${expires}`;
  return `${payload}.${await sign(payload)}`;
}

/** Devuelve { role } si la cookie es valida y no vencio, o null */
export async function readSessionValue(value) {
  if (!value || !authConfigured()) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [role, expires, signature] = parts;
  if (!["admin", "client"].includes(role)) return null;
  if (!(Number(expires) > Date.now())) return null;
  const expected = await sign(`${role}.${expires}`);
  return safeEqual(signature, expected) ? { role } : null;
}

/** Rol que corresponde a una contrasena, o null */
export function roleForPassword(password) {
  if (!password) return null;
  if (process.env.ADMIN_PASSWORD && safeEqual(password, process.env.ADMIN_PASSWORD)) return "admin";
  if (process.env.DASHBOARD_PASSWORD && safeEqual(password, process.env.DASHBOARD_PASSWORD)) return "client";
  return null;
}

/**
 * Clave del link de acceso directo del cliente (/acceso/<clave>). Se deriva
 * del secreto de sesion, asi que no hace falta guardarla en ningun lado; para
 * invalidar el link alcanza con cambiar DASHBOARD_PASSWORD o SESSION_SECRET.
 */
export async function clientLinkKey() {
  if (!authConfigured()) return null;
  return sign(`client-link:${process.env.DASHBOARD_PASSWORD || ""}`);
}

export async function isValidClientLinkKey(key) {
  const expected = await clientLinkKey();
  return Boolean(expected && key && safeEqual(key, expected));
}
