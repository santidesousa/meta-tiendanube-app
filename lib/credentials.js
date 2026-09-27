import { cookies } from "next/headers";

// De donde sale cada token. Prioridad:
//   1. Variables de entorno de Vercel: las usa cualquiera que entre al panel
//      (asi el cliente no tiene que conectar nada).
//   2. Cookie del OAuth: solo existe en el navegador de quien conecto; sirve
//      para que la agencia pruebe antes de copiar el token a Vercel.

export function getMetaCredentials() {
  if (process.env.META_ACCESS_TOKEN) {
    return { token: process.env.META_ACCESS_TOKEN, source: "env" };
  }
  const token = cookies().get("meta_access_token")?.value;
  return token ? { token, source: "cookie" } : null;
}

export function getTiendanubeCredentials() {
  const envToken = process.env.TIENDANUBE_ACCESS_TOKEN;
  const envStore = process.env.TIENDANUBE_STORE_ID;
  if (envToken && envStore) {
    return { token: envToken, storeId: envStore, source: "env" };
  }
  const token = cookies().get("tiendanube_access_token")?.value;
  const storeId = cookies().get("tiendanube_store_id")?.value;
  return token && storeId ? { token, storeId, source: "cookie" } : null;
}

export const NOT_CONNECTED_META = "No conectado con Meta todavia";
export const NOT_CONNECTED_TIENDANUBE = "No conectado con Tiendanube todavia";
