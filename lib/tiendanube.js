const BASE_URL = "https://api.tiendanube.com/v1";

/**
 * Llama a un endpoint de la API de Tiendanube.
 * @param {string} storeId - el user_id que devuelve el OAuth (id de la tienda)
 * @param {string} path - ej: "/orders"
 * @param {string} accessToken
 */
export async function tiendanubeFetch(storeId, path, accessToken) {
  const res = await fetch(`${BASE_URL}/${storeId}${path}`, {
    headers: {
      Authentication: `bearer ${accessToken}`,
      "User-Agent": "MetaTiendanubeApp (contacto@ejemplo.com)",
    },
  });

  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data?.message || "Error en la API de Tiendanube");
    err.details = data;
    throw err;
  }
  return data;
}

/** Datos generales de la tienda */
export function getStore(storeId, accessToken) {
  return tiendanubeFetch(storeId, "/store", accessToken);
}

/** Lista de pedidos/ventas (mas recientes primero) */
export function getOrders(storeId, accessToken, params = "") {
  return tiendanubeFetch(storeId, `/orders${params}`, accessToken);
}

/** Lista de productos */
export function getProducts(storeId, accessToken) {
  return tiendanubeFetch(storeId, "/products", accessToken);
}
