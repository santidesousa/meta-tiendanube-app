// Calculos del dashboard de Tiendanube. Funciones puras sobre la lista de
// pedidos "slim" que devuelve /api/tiendanube/orders.

import { addDays } from "./dateRange";
export { addDays, daysBetween, previousRange } from "./dateRange";

const TZ = "America/Argentina/Buenos_Aires";
const WEEKDAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAYS_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});

/** Dia (YYYY-MM-DD), hora (0-23) y dia de semana (0=Lun) en hora argentina */
export function localParts(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const p = Object.fromEntries(partsFormatter.formatToParts(d).map((x) => [x.type, x.value]));
  return {
    day: `${p.year}-${p.month}-${p.day}`,
    hour: parseInt(p.hour, 10) % 24,
    weekday: WEEKDAYS_EN.indexOf(p.weekday),
  };
}

/** Venta concretada: pagada y no cancelada */
export function isPaid(o) {
  return o.payment_status === "paid" && o.status !== "cancelled";
}

export function isPending(o) {
  return (
    o.status !== "cancelled" &&
    (o.payment_status === "pending" || o.payment_status === "authorized")
  );
}

export function isCancelled(o) {
  return (
    o.status === "cancelled" ||
    ["voided", "refunded", "abandoned"].includes(o.payment_status)
  );
}

function customerKey(o) {
  return o.customer?.id || o.customer?.email || o.customer?.name;
}

/**
 * KPIs del periodo. Con `range` ({ since }) ademas separa clientes nuevos
 * (cuyo alta en la tienda cae dentro del periodo) de recurrentes.
 */
export function computeSummary(orders, range) {
  const paid = orders.filter(isPaid);
  const pending = orders.filter(isPending);
  const cancelled = orders.filter(isCancelled);
  const revenue = paid.reduce((s, o) => s + o.total, 0);
  const units = paid.reduce(
    (s, o) => s + o.products.reduce((u, p) => u + p.quantity, 0),
    0
  );
  const customers = {};
  for (const o of paid) {
    const k = customerKey(o);
    if (!customers[k]) customers[k] = { orders: 0, revenue: 0, createdAt: o.customer?.created_at };
    customers[k].orders += 1;
    customers[k].revenue += o.total;
  }
  const list = Object.values(customers);

  let newCustomers = null;
  let newCustomersRevenue = null;
  if (range?.since && list.some((c) => c.createdAt)) {
    const isNew = (c) => c.createdAt && localParts(c.createdAt)?.day >= range.since;
    newCustomers = list.filter(isNew).length;
    newCustomersRevenue = list.filter(isNew).reduce((s, c) => s + c.revenue, 0);
  }

  return {
    revenue,
    paidCount: paid.length,
    avgTicket: paid.length ? revenue / paid.length : 0,
    units,
    unitsPerOrder: paid.length ? units / paid.length : 0,
    customers: list.length,
    repeatCustomers: list.filter((c) => c.orders > 1).length,
    newCustomers,
    returningCustomers: newCustomers === null ? null : list.length - newCustomers,
    newCustomersRevenue,
    pendingCount: pending.length,
    pendingAmount: pending.reduce((s, o) => s + o.total, 0),
    cancelledCount: cancelled.length,
    cancelledAmount: cancelled.reduce((s, o) => s + o.total, 0),
    cancelRate: orders.length ? cancelled.length / orders.length : 0,
    discountTotal: paid.reduce((s, o) => s + o.discount, 0),
    shippingTotal: paid.reduce((s, o) => s + o.shipping_cost, 0),
    conversionRate: orders.length ? paid.length / orders.length : 0,
  };
}

/** Serie diaria completa (incluye dias sin ventas) */
export function dailySeries(orders, since, until) {
  const map = {};
  for (let d = since; d <= until; d = addDays(d, 1)) {
    map[d] = { day: d, revenue: 0, orders: 0, units: 0 };
  }
  for (const o of orders.filter(isPaid)) {
    const day = localParts(o.created_at)?.day;
    if (!map[day]) continue;
    map[day].revenue += o.total;
    map[day].orders += 1;
    map[day].units += o.products.reduce((u, p) => u + p.quantity, 0);
  }
  return Object.values(map);
}

/** Ranking de productos (ventas pagadas), con imagen y variantes */
export function topProducts(orders) {
  const map = {};
  for (const o of orders.filter(isPaid)) {
    for (const p of o.products) {
      const key = p.product_id || p.name;
      if (!map[key]) {
        map[key] = {
          key: String(key),
          name: p.name,
          image: p.image,
          units: 0,
          revenue: 0,
          orderIds: new Set(),
          variants: {},
        };
      }
      const item = map[key];
      if (!item.image && p.image) item.image = p.image;
      item.units += p.quantity;
      item.revenue += p.quantity * p.price;
      item.orderIds.add(o.id);
      if (p.variant) item.variants[p.variant] = (item.variants[p.variant] || 0) + p.quantity;
    }
  }
  return Object.values(map).map((item) => ({
    ...item,
    orders: item.orderIds.size,
    variants: Object.entries(item.variants).sort((a, b) => b[1] - a[1]),
  }));
}

/** Agrupa ventas pagadas por una etiqueta (medio de pago, provincia, etc) */
export function breakdown(orders, labelFn) {
  const map = {};
  for (const o of orders.filter(isPaid)) {
    const labels = [].concat(labelFn(o) || "Sin dato");
    for (const label of labels) {
      if (!map[label]) map[label] = { label, count: 0, revenue: 0 };
      map[label].count += 1;
      map[label].revenue += o.total;
    }
  }
  return Object.values(map).sort((a, b) => b.revenue - a.revenue);
}

export function topCustomers(orders) {
  const map = {};
  for (const o of orders.filter(isPaid)) {
    const k = customerKey(o);
    if (!map[k]) map[k] = { label: o.customer.name, email: o.customer.email, count: 0, revenue: 0 };
    map[k].count += 1;
    map[k].revenue += o.total;
  }
  return Object.values(map).sort((a, b) => b.revenue - a.revenue);
}

/** Matriz 7x24 (dia de semana x hora) con cantidad de ventas pagadas */
export function salesHeatmap(orders) {
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const o of orders.filter(isPaid)) {
    const p = localParts(o.created_at);
    if (p && p.weekday >= 0) grid[p.weekday][p.hour] += 1;
  }
  return grid;
}

// --- Etiquetas legibles ---
const PAYMENT_METHODS = {
  credit_card: "Tarjeta de crédito",
  debit_card: "Tarjeta de débito",
  ticket: "Efectivo / cupón",
  bank_transfer: "Transferencia",
  wallet: "Billetera virtual",
  cash: "Efectivo",
  other: "Otro",
};

export function paymentLabel(o) {
  const method = PAYMENT_METHODS[o.payment_method] || o.payment_method;
  if (o.gateway && method) return `${o.gateway} · ${method}`;
  return o.gateway || method || "Sin dato";
}

export const PAYMENT_STATUS = {
  paid: { label: "Pagado", cls: "badge-active" },
  pending: { label: "Pendiente", cls: "badge-paused" },
  authorized: { label: "Autorizado", cls: "badge-paused" },
  abandoned: { label: "Abandonado", cls: "badge-danger" },
  refunded: { label: "Reembolsado", cls: "badge-danger" },
  voided: { label: "Anulado", cls: "badge-danger" },
};

export const SHIPPING_STATUS = {
  unpacked: { label: "Por empaquetar", cls: "badge-paused" },
  unfulfilled: { label: "Por enviar", cls: "badge-paused" },
  fulfilled: { label: "Enviado", cls: "badge-active" },
  shipped: { label: "Enviado", cls: "badge-active" },
  delivered: { label: "Entregado", cls: "badge-active" },
};

// Umbral de "stock bajo": menos de estos dias de venta al ritmo del periodo.
export const LOW_STOCK_DAYS = 14;

/**
 * Estado de stock de un producto vendido. `stockMap` es la respuesta de
 * /api/tiendanube/stock; `units`/`days` son las ventas del periodo, para
 * estimar cuantos dias de stock quedan al ritmo actual.
 * level: "out" (agotado), "low", "ok", "unlimited" o null (sin datos).
 */
export function stockStatus(productKey, units, days, stockMap) {
  const info = stockMap?.[productKey];
  if (!info) return null;
  if (info.stock === null) return { level: "unlimited", stock: null, daysLeft: null, outVariants: [] };
  const perDay = days > 0 ? units / days : 0;
  const daysLeft = perDay > 0 ? info.stock / perDay : null;
  const level =
    info.stock <= 0 ? "out" : daysLeft !== null && daysLeft < LOW_STOCK_DAYS ? "low" : "ok";
  return { level, stock: info.stock, daysLeft, outVariants: info.outOfStockVariants || [] };
}

/**
 * Serie de KPIs por bloques de `stepDays` dias (1 = diaria, 7 = semanal,
 * igual que el time_increment de Meta), con los mismos campos que
 * computeSummary. En cada bloque, "cliente nuevo" = alta dentro del bloque.
 * Los ratios quedan en null cuando no hay base, para no dibujar ceros
 * inexistentes.
 */
export function periodSeries(orders, since, until, stepDays = 1) {
  const byDay = {};
  for (const o of orders) {
    const day = localParts(o.created_at)?.day;
    if (day) (byDay[day] = byDay[day] || []).push(o);
  }
  const out = [];
  for (let start = since; start <= until; start = addDays(start, stepDays)) {
    let end = addDays(start, stepDays - 1);
    if (end > until) end = until;
    const chunk = [];
    for (let d = start; d <= end; d = addDays(d, 1)) chunk.push(...(byDay[d] || []));
    const s = computeSummary(chunk, { since: start });
    out.push({
      day: start,
      until: end,
      ...s,
      avgTicket: s.paidCount ? s.avgTicket : null,
      conversionRate: chunk.length ? s.conversionRate : null,
      cancelRate: chunk.length ? s.cancelRate : null,
    });
  }
  return out;
}
