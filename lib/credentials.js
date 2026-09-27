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
