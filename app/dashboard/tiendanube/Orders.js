"use client";

import { useEffect, useState } from "react";
import {
  PAYMENT_STATUS,
  SHIPPING_STATUS,
  isCancelled,
  isPaid,
  isPending,
  paymentLabel,
} from "@/lib/tiendanubeMetrics";
import { ProductThumb } from "./Insights";
import { formatDateTime, formatMoney } from "./format";

const PAGE_SIZE = 25;

const STATUS_FILTERS = [
  { key: "ALL", label: "Todos", test: () => true },
  { key: "PAID", label: "Pagados", test: isPaid },
  { key: "PENDING", label: "Pendientes", test: isPending },
  { key: "CANCELLED", label: "Cancelados", test: isCancelled },
];

function PaymentBadge({ order }) {
  if (order.status === "cancelled") return <span className="badge badge-danger">Cancelado</span>;
  const s = PAYMENT_STATUS[order.payment_status] || { label: order.payment_status, cls: "badge-other" };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

function ShippingBadge({ order }) {
  if (order.pickup && order.shipping_status !== "fulfilled") {
    return <span className="badge badge-other">Retiro en local</span>;
  }
  const s = SHIPPING_STATUS[order.shipping_status];
  if (!s) return <span className="badge badge-other">{order.shipping_status || "—"}</span>;
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

function matchesSearch(o, q) {
  if (!q) return true;
  const haystack = [
    String(o.number),
    o.customer.name,
    o.customer.email,
    o.address?.city,
    o.address?.province,
    ...o.products.map((p) => p.full_name),
    ...o.coupons,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q.toLowerCase());
}

/**
 * Lista de pedidos. `externalFilters` son los filtros que vienen de otras
 * secciones (dia del grafico, producto del ranking) y se muestran como chips.
 */
export function OrdersSection({ orders, currency, externalFilters, onClearExternal }) {
  const [status, setStatus] = useState("ALL");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [openOrder, setOpenOrder] = useState(null);

  // Volver a la primera pagina cuando cambian los filtros.
  useEffect(() => setLimit(PAGE_SIZE), [status, query, externalFilters.length, orders]);

  const base = orders.filter((o) => externalFilters.every((f) => f.test(o)) && matchesSearch(o, query));
  const counts = Object.fromEntries(STATUS_FILTERS.map((f) => [f.key, base.filter(f.test).length]));
  const filtered = base
    .filter(STATUS_FILTERS.find((f) => f.key === status).test)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const visible = filtered.slice(0, limit);
  const filteredTotal = filtered.filter(isPaid).reduce((s, o) => s + o.total, 0);

  return (
    <div className="card" id="pedidos">
      <div className="section-head">
        <div>
          <h2>Pedidos</h2>
          <div className="section-sub">
            {filtered.length} pedidos · {formatMoney(filteredTotal, currency)} cobrados · click en un pedido
            para ver el detalle
          </div>
        </div>
        <input
          className="search-input"
          type="search"
          placeholder="Buscar cliente, #pedido, producto, ciudad…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="filter-row" style={{ flexWrap: "wrap" }}>
        {STATUS_FILTERS.map((f) => (
          <div
            key={f.key}
            className={"filter-pill" + (status === f.key ? " active" : "")}
            onClick={() => setStatus(f.key)}
          >
            {f.label} ({counts[f.key]})
          </div>
        ))}
        {externalFilters.map((f) => (
          <div key={f.key} className="filter-chip" onClick={() => onClearExternal(f.key)}>
            {f.label} <span aria-label="Quitar filtro">×</span>
          </div>
        ))}
      </div>

      <div className="table-scroll">
        <table className="data-table orders-table">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Productos</th>
              <th style={{ textAlign: "right" }}>Total</th>
              <th>Pago</th>
              <th>Envío</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((o) => {
              const units = o.products.reduce((s, p) => s + p.quantity, 0);
              return (
                <tr key={o.id} className="row-clickable" onClick={() => setOpenOrder(o)}>
                  <td>
                    <div className="mono strong">#{o.number}</div>
                    <div className="muted small">{formatDateTime(o.created_at)}</div>
                  </td>
                  <td>
                    <div>{o.customer.name}</div>
                    <div className="muted small">
                      {[o.address?.city, o.address?.province].filter(Boolean).join(", ")}
                    </div>
                  </td>
                  <td>
                    <div className="thumb-stack">
                      {o.products.slice(0, 3).map((p, i) => (
                        <ProductThumb key={i} src={p.image} alt={p.name} size={34} />
                      ))}
                      <span className="small muted">
                        {o.products.length === 1
                          ? truncate(o.products[0].full_name, 34)
                          : `${units} u. · ${o.products.length} productos`}
                      </span>
                    </div>
                  </td>
                  <td className="mono" style={{ textAlign: "right" }}>
                    {formatMoney(o.total, o.currency)}
                  </td>
                  <td>
                    <PaymentBadge order={o} />
                  </td>
                  <td>
                    <ShippingBadge order={o} />
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-state">
                  No hay pedidos con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > limit && (
        <button className="link-btn" onClick={() => setLimit(limit + PAGE_SIZE)}>
          Ver más ({filtered.length - limit} restantes)
        </button>
      )}

      {openOrder && <OrderDrawer order={openOrder} onClose={() => setOpenOrder(null)} />}
    </div>
  );
}

function truncate(s, n) {
  return s && s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function OrderDrawer({ order: o, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const itemsTotal = o.products.reduce((s, p) => s + p.price * p.quantity, 0);

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <h2>Pedido #{o.number}</h2>
            <div className="muted small">{formatDateTime(o.created_at)}</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          <PaymentBadge order={o} />
          <ShippingBadge order={o} />
        </div>

        <h3 className="drawer-title">Productos</h3>
        {o.products.map((p, i) => (
          <div key={i} className="drawer-product">
            <ProductThumb src={p.image} alt={p.name} size={56} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="strong">{p.name}</div>
              {p.variant && <div className="muted small">{p.variant}</div>}
              {p.sku && <div className="muted small mono">SKU {p.sku}</div>}
            </div>
            <div className="mono" style={{ textAlign: "right" }}>
              <div>
                {p.quantity} × {formatMoney(p.price, o.currency)}
              </div>
              <div className="strong">{formatMoney(p.price * p.quantity, o.currency)}</div>
            </div>
          </div>
        ))}

        <div className="drawer-totals mono">
          <Row label="Productos" value={formatMoney(itemsTotal, o.currency)} />
          {o.discount > 0 && (
            <Row
              label={`Descuento${o.coupons.length ? ` (${o.coupons.join(", ")})` : ""}`}
              value={`−${formatMoney(o.discount, o.currency)}`}
            />
          )}
          <Row label="Envío" value={o.shipping_cost > 0 ? formatMoney(o.shipping_cost, o.currency) : "Gratis"} />
          <Row label="Total" value={formatMoney(o.total, o.currency)} strong />
        </div>

        <h3 className="drawer-title">Cliente</h3>
        <div className="drawer-block">
          <div className="strong">{o.customer.name}</div>
          {o.customer.email && (
            <div>
              <a href={`mailto:${o.customer.email}`}>{o.customer.email}</a>
            </div>
          )}
          {o.customer.phone && <div>{o.customer.phone}</div>}
        </div>

        <h3 className="drawer-title">Pago</h3>
        <div className="drawer-block">
          <div>{paymentLabel(o)}</div>
          {o.card_company && <div className="muted small">{o.card_company}</div>}
          {o.installments > 1 && <div className="muted small">{o.installments} cuotas</div>}
          {o.paid_at && <div className="muted small">Pagado el {formatDateTime(o.paid_at)}</div>}
        </div>

        <h3 className="drawer-title">Envío</h3>
        <div className="drawer-block">
          <div>{o.pickup ? "Retiro en local" : o.shipping_option || "—"}</div>
          {o.address && !o.pickup && (
            <div className="muted small">
              {[o.address.street, o.address.floor].filter(Boolean).join(", ")}
              <br />
              {[o.address.city, o.address.province, o.address.zipcode].filter(Boolean).join(", ")}
            </div>
          )}
        </div>

        {o.note && (
          <>
            <h3 className="drawer-title">Nota del cliente</h3>
            <div className="drawer-block">{o.note}</div>
          </>
        )}
      </aside>
    </div>
  );
}

function Row({ label, value, strong }) {
  return (
    <div className={"drawer-row" + (strong ? " strong" : "")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
