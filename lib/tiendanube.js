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

/**
 * Trae todos los pedidos que matchean los filtros, recorriendo las paginas.
 * Tiendanube devuelve como maximo 200 por pagina, y responde 404
 * ("Last page is N") cuando se pide una pagina que no existe.
 * @param {Record<string,string>} filters - ej: { created_at_min, created_at_max }
 * @param {number} maxPages - tope de seguridad
 */
export async function getAllOrders(storeId, accessToken, filters = {}, maxPages = 25) {
  const perPage = 200;
  const all = [];
  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({ ...filters, per_page: String(perPage), page: String(page) });
    let batch;
    try {
      batch = await getOrders(storeId, accessToken, `?${params.toString()}`);
    } catch (err) {
      if (err.details?.code === 404) break;
      throw err;
    }
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < perPage) break;
  }
  return all;
}

/** Lista de productos */
export function getProducts(storeId, accessToken) {
  return tiendanubeFetch(storeId, "/products", accessToken);
}
