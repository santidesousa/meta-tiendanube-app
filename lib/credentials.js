// Credenciales de Meta y Tiendanube: SOLO desde variables de entorno de
// Vercel. Asi cualquiera que entre al panel ve los datos de Tout Revient sin
// conectar nada. Los tokens se obtienen una vez con /api/auth/meta y
// /api/auth/tiendanube (la pagina de callback los muestra para copiarlos).

export function getMetaCredentials() {
  const token = process.env.META_ACCESS_TOKEN;
  return token ? { token, source: "env" } : null;
}

export function getTiendanubeCredentials() {
  const token = process.env.TIENDANUBE_ACCESS_TOKEN;
  const storeId = process.env.TIENDANUBE_STORE_ID;
  return token && storeId ? { token, storeId, source: "env" } : null;
}

export const NOT_CONNECTED_META = "No conectado con Meta todavia";
export const NOT_CONNECTED_TIENDANUBE = "No conectado con Tiendanube todavia";

export const NOT_CONNECTED_GA = "No conectado con Google Analytics todavia";

/**
 * Google Analytics 4: cuenta de servicio (no vence).
 * - GA_PROPERTY_ID: id numerico de la propiedad (ej. 123456789)
 * - GA_SERVICE_ACCOUNT_JSON: el contenido completo del .json de la clave
 * Devuelve null si falta algo, o { error } si el JSON no es valido.
 */
export function getGaCredentials() {
  const propertyId = (process.env.GA_PROPERTY_ID || "").replace(/^properties\//, "").trim();
  const raw = process.env.GA_SERVICE_ACCOUNT_JSON;
  if (!propertyId || !raw) return null;
  try {
    const json = JSON.parse(raw);
    if (!json.client_email || !json.private_key) throw new Error("faltan client_email o private_key");
    return {
      propertyId,
      clientEmail: json.client_email,
      // Si la clave se pego con "\n" literales, los convertimos en saltos de linea.
      privateKey: json.private_key.replace(/\\n/g, "\n"),
      source: "env",
    };
  } catch (err) {
    return { error: `GA_SERVICE_ACCOUNT_JSON no es un JSON válido de cuenta de servicio (${err.message})` };
  }
}
