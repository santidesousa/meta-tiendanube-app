const BASE_URL = "https://api.tiendanube.com/v1";

// Este dashboard es exclusivo de Tout Revient. La agencia tiene la app
// instalada en varias tiendas, y el OAuth conecta la que este logueada en
// el navegador: sin este chequeo se podian ver datos de otro cliente.
// Si TIENDANUBE_STORE_ID esta configurado se valida por id (lo mas seguro);
// si no, se valida por nombre de tienda.
export const ALLOWED_STORE_NAME = "Tout Revient";

function normalize(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function storeName(store) {
  const name = store?.name;
  if (!name) return "";
  if (typeof name === "string") return name;
  return name.es || name.pt || name.en || Object.values(name)[0] || "";
}

/**
 * Verifica que la tienda conectada sea la permitida. Devuelve
 * { ok, store: { id, name } } sin lanzar error si no coincide.
 */
export async function verifyStore(storeId, accessToken) {
  const expectedId = process.env.TIENDANUBE_STORE_ID;
  const store = await getStore(storeId, accessToken);
  const info = { id: String(store.id || storeId), name: storeName(store) };
  const ok = expectedId
    ? String(storeId) === String(expectedId)
    : normalize(info.name).includes(normalize(ALLOWED_STORE_NAME));
  return { ok, store: info };
}

export function wrongStoreMessage(store) {
  return `La tienda conectada es "${store.name || store.id}", no ${ALLOWED_STORE_NAME}. Este panel solo muestra datos de ${ALLOWED_STORE_NAME}.`;
}

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
 * Recorre todas las paginas de un listado de Tiendanube. Devuelve como
 * maximo 200 por pagina, y responde 404 ("Last page is N") cuando se pide
 * una pagina que no existe.
 * @param {string} path - ej: "/orders"
 * @param {Record<string,string>} filters - query params del listado
 * @param {number} maxPages - tope de seguridad
 */
export async function tiendanubeFetchAll(storeId, accessToken, path, filters = {}, maxPages = 25) {
  const perPage = 200;
  const all = [];
  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({ ...filters, per_page: String(perPage), page: String(page) });
    let batch;
    try {
      batch = await tiendanubeFetch(storeId, `${path}?${params.toString()}`, accessToken);
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

/**
 * Todos los pedidos que matchean los filtros.
 * @param {Record<string,string>} filters - ej: { created_at_min, created_at_max }
 */
export function getAllOrders(storeId, accessToken, filters = {}) {
  return tiendanubeFetchAll(storeId, accessToken, "/orders", filters);
}

/** Carritos abandonados (checkouts sin completar) */
export function getAllAbandonedCheckouts(storeId, accessToken, filters = {}) {
  return tiendanubeFetchAll(storeId, accessToken, "/checkouts", filters, 10);
}

/** Todos los productos, con sus variantes y stock */
export function getAllProducts(storeId, accessToken) {
  return tiendanubeFetchAll(storeId, accessToken, "/products", {}, 20);
}

/** Lista de productos */
export function getProducts(storeId, accessToken) {
  return tiendanubeFetch(storeId, "/products", accessToken);
}
