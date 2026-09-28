// Alertas automaticas de la Home ("Que mirar"). Funciones puras: reciben
// los datos ya calculados y devuelven una lista ordenada por importancia.

import { LOW_STOCK_DAYS, stockStatus } from "./tiendanubeMetrics";

const LEVEL_ORDER = { danger: 0, warning: 1, info: 2, good: 3 };

function pct(v) {
  return `${Math.round(Math.abs(v) * 100)}%`;
}

/**
 * @param {object} p
 * @param {object|null} p.store     - computeSummary de Tiendanube (periodo)
 * @param {object|null} p.prevStore - idem periodo anterior
 * @param {object|null} p.meta      - totales de Meta con ratios
 * @param {object|null} p.prevMeta  - idem periodo anterior
 * @param {Array} p.ads             - anuncios con .m (ratios)
 * @param {Array} p.products        - topProducts() de Tiendanube
 * @param {object|null} p.stock     - respuesta de /api/tiendanube/stock
 * @param {object|null} p.abandoned - respuesta de /api/tiendanube/abandoned
 * @param {number} p.days           - dias del periodo
 * @param {number} p.margin         - margen bruto 0..1
 * @param {(v:number)=>string} p.money
 */
export function computeAlerts({ store, prevStore, meta, prevMeta, ads = [], products = [], stock, abandoned, days, margin, money }) {
  const alerts = [];
  const add = (level, title, detail, href) => alerts.push({ level, title, detail, href });

  // 1. ¿La inversion se paga?
  if (store && meta?.spend > 0 && margin > 0) {
    const roas = store.revenue / meta.spend;
    const breakeven = 1 / margin;
    const profit = store.revenue * margin - meta.spend;
    if (roas < breakeven) {
      add(
        "danger",
        "La inversión en Meta no se está pagando",
        `ROAS real ${roas.toFixed(2)}x, por debajo del equilibrio de ${breakeven.toFixed(2)}x con un margen de ${Math.round(margin * 100)}%. Resultado después de publicidad: ${money(profit)}.`,
        "/dashboard/meta"
      );
    } else {
      add(
        "good",
        `Cada $1 invertido en Meta vuelve $${roas.toFixed(2)} en ventas`,
        `Por encima del equilibrio (${breakeven.toFixed(2)}x). Ganancia después de publicidad: ${money(profit)}.`,
        null
      );
    }
  }

  // 2. Anuncios gastando sin resultados de SU objetivo (un anuncio de
  // trafico con clics no es un problema aunque no venda). Los anuncios
  // llegan con `obj` de rankByObjective; si no, se cae a "sin compras".
  const noResults = ads.filter((a) => (a.obj ? a.obj.noResult : a.m.noResults));
  if (noResults.length && meta?.spend) {
    const wasted = noResults.reduce((s, a) => s + a.m.spend, 0);
    const share = wasted / meta.spend;
    add(
      share > 0.15 ? "danger" : "warning",
      `${noResults.length} ${noResults.length === 1 ? "anuncio gastó" : "anuncios gastaron"} ${money(wasted)} sin resultados`,
      `Sin compras, añadidos al carrito o clics según el objetivo de cada uno. Es el ${pct(share)} de la inversión del período: revisar si pausarlos o cambiarles la creatividad.`,
      "/dashboard/meta"
    );
  }

  // 3. Costo por compra
  if (meta?.cpa && prevMeta?.cpa) {
    const change = (meta.cpa - prevMeta.cpa) / prevMeta.cpa;
    if (change > 0.2) {
      add("warning", `El costo por compra subió ${pct(change)}`, `De ${money(prevMeta.cpa)} a ${money(meta.cpa)} vs. el período anterior.`, "/dashboard/meta");
    } else if (change < -0.15) {
      add("good", `El costo por compra bajó ${pct(change)}`, `De ${money(prevMeta.cpa)} a ${money(meta.cpa)} vs. el período anterior.`, "/dashboard/meta");
    }
  }

  // 4. Fatiga de creatividades
  const fatigued = ads.filter((a) => a.m.fatigue);
  if (fatigued.length) {
    add(
      "warning",
      `${fatigued.length} ${fatigued.length === 1 ? "anuncio muestra" : "anuncios muestran"} fatiga`,
      "La misma gente los vio demasiadas veces. Conviene renovar creatividades o ampliar el público.",
      "/dashboard/meta"
    );
  }

  // 5. Stock de los mas vendidos
  if (stock && products.length) {
    const top = [...products].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    const risky = top
      .map((p) => ({ p, s: stockStatus(p.key, p.units, days, stock) }))
      .filter(({ s }) => s && (s.level === "out" || s.level === "low"));
    if (risky.length) {
      const names = risky.slice(0, 3).map(({ p, s }) => (s.level === "out" ? `${p.name} (agotado)` : `${p.name} (≈${Math.round(s.daysLeft)} días)`));
      add(
        risky.some(({ s }) => s.level === "out") ? "danger" : "warning",
        `${risky.length} de los más vendidos con poco stock`,
        `${names.join(", ")}${risky.length > 3 ? "…" : ""}. Menos de ${LOW_STOCK_DAYS} días al ritmo actual: evitar pautarlos o reponer.`,
        "/dashboard/tiendanube"
      );
    }
  }

  // 6. Facturacion vs periodo anterior
  if (store && prevStore?.revenue) {
    const change = (store.revenue - prevStore.revenue) / prevStore.revenue;
    if (change <= -0.15) add("warning", `La facturación cayó ${pct(change)}`, "Comparado con el período anterior de igual duración.", "/dashboard/tiendanube");
    else if (change >= 0.15) add("good", `La facturación creció ${pct(change)}`, "Comparado con el período anterior de igual duración.", "/dashboard/tiendanube");
  }

  // 7. Plata sobre la mesa
  if (abandoned?.total > 0) {
    add("info", `${money(abandoned.total)} en carritos abandonados`, `${abandoned.count} carritos sin terminar. Tienen link de recuperación para mandarle a cada cliente.`, "/dashboard/tiendanube");
  }
  if (store?.pendingCount > 0) {
    add("info", `${money(store.pendingAmount)} pendientes de cobro`, `${store.pendingCount} pedidos esperando el pago.`, "/dashboard/tiendanube");
  }
  if (store && store.cancelRate > 0.1) {
    add("warning", `Cancelaciones altas: ${pct(store.cancelRate)} de los pedidos`, "Revisar motivos (stock, pagos rechazados, envíos).", "/dashboard/tiendanube");
  }

  return alerts.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}
