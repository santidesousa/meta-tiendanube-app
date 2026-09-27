"use client";

import { useEffect, useState } from "react";
import DateRangePicker, { presetRange } from "../DateRangePicker";

function formatMoney(value, currency = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function TiendanubePage() {
  const [range, setRange] = useState({ key: "30d", ...presetRange("30d") });
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setOrders(null);
    fetch(`/api/tiendanube/orders?since=${range.since}&until=${range.until}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setOrders(data);
      })
      .catch((err) => setError(err.message));
  }, [range]);

  return (
    <div>
      <h1>Tiendanube</h1>
      <DateRangePicker activeKey={range.key} onChange={setRange} />

      {error && (
        <>
          <p style={{ color: "var(--danger)" }}>
            {error === "No conectado con Tiendanube todavia"
              ? "Todavía no conectaste tu cuenta de Tiendanube."
              : `Error: ${error}`}
          </p>
          <a href="/api/auth/tiendanube" className="btn btn-tiendanube">
            Conectar cuenta de Tiendanube
          </a>
        </>
      )}

      {!error && !orders && (
        <p style={{ color: "var(--muted)" }}>Cargando pedidos...</p>
      )}

      {!error && orders && <TiendanubeContent orders={orders} range={range} />}
    </div>
  );
}

function TiendanubeContent({ orders, range }) {

  const paidOrders = orders.filter((o) => o.payment_status === "paid");
  const totalRevenue = paidOrders.reduce(
    (sum, o) => sum + parseFloat(o.total || 0),
    0
  );
  const avgTicket = paidOrders.length ? totalRevenue / paidOrders.length : 0;
  const currency = orders[0]?.currency || "ARS";
  const pendingCount = orders.filter(
    (o) => o.payment_status === "pending" || o.payment_status === "authorized"
  ).length;

  // Ventas por dia
  const byDay = {};
  for (const o of paidOrders) {
    const day = (o.created_at || "").slice(0, 10);
    if (!byDay[day]) byDay[day] = { count: 0, total: 0 };
    byDay[day].count += 1;
    byDay[day].total += parseFloat(o.total || 0);
  }
  const days = Object.entries(byDay).sort((a, b) => (a[0] < b[0] ? 1 : -1));

  // Productos mas vendidos (por cantidad e ingresos)
  const byProduct = {};
  for (const o of paidOrders) {
    for (const p of o.products || []) {
      const key = p.name_without_variants || p.name;
      if (!byProduct[key]) byProduct[key] = { qty: 0, revenue: 0 };
      byProduct[key].qty += p.quantity || 0;
      byProduct[key].revenue += (p.quantity || 0) * parseFloat(p.price || 0);
    }
  }
  const topProducts = Object.entries(byProduct)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 6);

  return (
    <div>
      <p style={{ color: "var(--muted)", marginTop: 0, fontSize: "0.85rem" }}>
        Últimos {orders.length} pedidos ({pendingCount} pendientes de pago no
        incluidos en los totales)
      </p>

      <div className="kpi-row">
        <div className="kpi-card">
          <div className="kpi-label">Ventas totales</div>
          <div className="kpi-value">
            {formatMoney(totalRevenue, currency)}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Pedidos pagados</div>
          <div className="kpi-value">{paidOrders.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Ticket promedio</div>
          <div className="kpi-value">{formatMoney(avgTicket, currency)}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "2rem", alignItems: "flex-start" }}>
        <div style={{ flex: 1.4 }}>
          <h2>Ventas por día</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Día</th>
                <th>Pedidos</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {days.map(([day, data]) => (
                <tr key={day}>
                  <td>{day}</td>
                  <td className="mono">{data.count}</td>
                  <td className="mono">{formatMoney(data.total, currency)}</td>
                </tr>
              ))}
              {days.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty-state">
                    Todavía no hay ventas pagadas en este período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ flex: 1 }}>
          <h2>Productos más vendidos</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cant.</th>
                <th>Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map(([name, data]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td className="mono">{data.qty}</td>
                  <td className="mono">{formatMoney(data.revenue, currency)}</td>
                </tr>
              ))}
              {topProducts.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty-state">
                    Sin datos de productos todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
