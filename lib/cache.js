import { revalidateTag, unstable_cache } from "next/cache";

// Cache de respuestas de Meta y Tiendanube en el servidor (Vercel Data
// Cache). Evita consultar las APIs en cada carga de pagina y respetar sus
// limites. "Actualizar" en el panel invalida todo (ver /api/refresh).
export const CACHE_SECONDS = 600;

/**
 * Ejecuta fn() cacheando su resultado bajo tag + keyParts.
 * Devuelve { data, generatedAt }. Si fn lanza error no se cachea nada.
 */
export function cached(tag, keyParts, fn) {
  return unstable_cache(
    async () => ({ data: await fn(), generatedAt: new Date().toISOString() }),
    [tag, ...keyParts.map(String)],
    { revalidate: CACHE_SECONDS, tags: [tag] }
  )();
}

export function invalidateAll() {
  revalidateTag("meta");
  revalidateTag("tiendanube");
}
