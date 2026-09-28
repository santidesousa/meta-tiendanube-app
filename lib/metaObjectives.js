// Objetivo de cada anuncio y como se mide su rendimiento.
//
// Una creatividad se evalua segun para que se pauto:
//   - Conversiones:      la que mas compras trajo
//   - DPA (catalogo):    la que mas ventas trajo
//   - Anadir al carrito: la que mas anadidos al carrito trajo
//   - Trafico:           la que mas clics trajo
//
// El tipo se deduce del conjunto de anuncios (evento de optimizacion y
// catalogo promocionado) y del objetivo de la campana. Funciones puras: se
// usan en el servidor (clasificar) y en el cliente (resultados y ranking).

export const OBJECTIVE_TYPES = {
  conversions: {
    label: "Conversiones",
    resultKey: "purchases",
    resultLabel: "Compras",
    unit: ["compra", "compras"],
    costLabel: "Costo por compra",
  },
  dpa: {
    label: "DPA (catálogo)",
    resultKey: "purchases",
    resultLabel: "Ventas",
    unit: ["venta", "ventas"],
    costLabel: "Costo por venta",
  },
  add_to_cart: {
    label: "Añadir al carrito",
    resultKey: "addToCart",
    resultLabel: "Añadidos al carrito",
    unit: ["añadido", "añadidos"],
    costLabel: "Costo por añadido",
  },
  traffic: {
    label: "Tráfico",
    resultKey: "linkClicks",
    resultLabel: "Clics",
    unit: ["clic", "clics"],
    costLabel: "Costo por clic",
  },
  other: {
    label: "Otro objetivo",
    resultKey: "purchases",
    resultLabel: "Compras",
    unit: ["compra", "compras"],
    costLabel: "Costo por compra",
  },
};

// Orden en que se muestran los grupos.
export const OBJECTIVE_ORDER = ["conversions", "dpa", "add_to_cart", "traffic", "other"];

const TRAFFIC_OBJECTIVES = ["OUTCOME_TRAFFIC", "LINK_CLICKS"];
const TRAFFIC_GOALS = ["LINK_CLICKS", "LANDING_PAGE_VIEWS"];
const SALES_OBJECTIVES = ["OUTCOME_SALES", "CONVERSIONS"];
const SALES_GOALS = ["OFFSITE_CONVERSIONS", "VALUE"];

/**
 * @param {object} p
 * @param {string} [p.objective]        - objetivo de la campana (ej. OUTCOME_SALES)
 * @param {string} [p.optimizationGoal] - del conjunto (ej. OFFSITE_CONVERSIONS)
 * @param {object} [p.promotedObject]   - del conjunto (custom_event_type, product_catalog_id...)
 * @returns {keyof OBJECTIVE_TYPES}
 */
export function classifyObjective({ objective, optimizationGoal, promotedObject } = {}) {
  const po = promotedObject || {};
  // Catalogo: anuncios dinamicos de producto.
  if (objective === "PRODUCT_CATALOG_SALES" || po.product_catalog_id || po.product_set_id) return "dpa";
  if (TRAFFIC_OBJECTIVES.includes(objective) || TRAFFIC_GOALS.includes(optimizationGoal)) return "traffic";
  // Antes que "conversiones": una campana de ventas puede optimizar a carrito.
  if (po.custom_event_type === "ADD_TO_CART") return "add_to_cart";
  if (
    SALES_OBJECTIVES.includes(objective) ||
    SALES_GOALS.includes(optimizationGoal) ||
    po.custom_event_type === "PURCHASE"
  ) {
    return "conversions";
  }
  return "other";
}

/** Tipo mas frecuente en una lista (para clasificar una campana por sus conjuntos) */
export function dominantType(types) {
  const counts = {};
  for (const t of types) counts[t] = (counts[t] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

/**
 * Resultado segun el objetivo, a partir de metricas con ratios (withRatios).
 * noResult: gasto sin ningun resultado del objetivo (no "sin ventas": un
 * anuncio de trafico con clics esta cumpliendo su objetivo).
 */
export function objectiveResult(type, m) {
  const def = OBJECTIVE_TYPES[type] || OBJECTIVE_TYPES.other;
  const result = m?.[def.resultKey] || 0;
  return {
    type: OBJECTIVE_TYPES[type] ? type : "other",
    def,
    result,
    costPerResult: result > 0 ? m.spend / result : null,
    noResult: (m?.spend || 0) > 0 && result === 0,
  };
}

/**
 * Agrega a cada anuncio su resultado y su posicion dentro de su objetivo
 * (1 = el que mejor performo). Solo compiten los que tuvieron actividad.
 */
export function rankByObjective(ads) {
  const withResult = ads.map((a) => ({ ...a, obj: objectiveResult(a.objectiveType, a.m) }));
  const groups = {};
  for (const a of withResult) {
    if (!(a.m.spend > 0 || a.m.impressions > 0)) continue;
    (groups[a.obj.type] = groups[a.obj.type] || []).push(a);
  }
  const rankById = {};
  for (const list of Object.values(groups)) {
    // Mas resultados primero; a igualdad, menor costo por resultado.
    list.sort((x, y) => y.obj.result - x.obj.result || (x.obj.costPerResult ?? Infinity) - (y.obj.costPerResult ?? Infinity));
    list.forEach((a, i) => {
      if (a.obj.result > 0) rankById[a.id] = { rank: i + 1, of: list.length };
    });
  }
  return withResult.map((a) => ({ ...a, obj: { ...a.obj, ...(rankById[a.id] || {}) } }));
}

export function formatResult(obj, formatNumber) {
  const [one, many] = obj.def.unit;
  return `${formatNumber(obj.result)} ${obj.result === 1 ? one : many}`;
}
