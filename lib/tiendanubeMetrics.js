// Calculos del dashboard de Tiendanube. Funciones puras sobre la lista de
// pedidos "slim" que devuelve /api/tiendanube/orders.

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

export function computeSummary(orders) {
  const paid = orders.filter(isPaid);
  const pending = orders.filter(isPending);
  const revenue = paid.reduce((s, o) => s + o.total, 0);
  const units = paid.reduce(
    (s, o) => s + o.products.reduce((u, p) => u + p.quantity, 0),
    0
  );
  const ordersByCustomer = {};
  for (const o of paid) {
    const k = customerKey(o);
    ordersByCustomer[k] = (ordersByCustomer[k] || 0) + 1;
  }
  const customers = Object.keys(ordersByCustomer).length;
  const repeatCustomers = Object.values(ordersByCustomer).filter((n) => n > 1).length;

  return {
    revenue,
    paidCount: paid.length,
    avgTicket: paid.length ? revenue / paid.length : 0,
    units,
    unitsPerOrder: paid.length ? units / paid.length : 0,
    customers,
    repeatCustomers,
    pendingCount: pending.length,
    pendingAmount: pending.reduce((s, o) => s + o.total, 0),
    cancelledCount: orders.filter(isCancelled).length,
    discountTotal: paid.reduce((s, o) => s + o.discount, 0),
    shippingTotal: paid.reduce((s, o) => s + o.shipping_cost, 0),
    conversionRate: orders.length ? paid.length / orders.length : 0,
  };
}

// --- Fechas como strings YYYY-MM-DD (en UTC para evitar problemas de DST) ---
function parseDay(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function formatDay(d) {
  return d.toISOString().slice(0, 10);
}
export function addDays(s, n) {
  const d = parseDay(s);
  d.setUTCDate(d.getUTCDate() + n);
  return formatDay(d);
}
export function daysBetween(since, until) {
  return Math.round((parseDay(until) - parseDay(since)) / 86400000) + 1;
}

/** Periodo inmediatamente anterior, de la misma duracion */
export function previousRange({ since, until }) {
  const len = daysBetween(since, until);
  const prevUntil = addDays(since, -1);
  return { since: addDays(prevUntil, -(len - 1)), until: prevUntil };
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
