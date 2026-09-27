"use client";

import { useEffect, useState } from "react";

const cardStyle = {
  background: "#fff",
  border: "1px solid #e2e2e2",
  borderRadius: 10,
  padding: "1.25rem",
  minWidth: 180,
};

function formatMoney(value, currency = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function TiendanubePage() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/tiendanube/orders")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setOrders(data);
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div>
        <h1>Tiendanube</h1>
        <p style={{ color: "#c0392b" }}>
          {error === "No conectado con Tiendanube todavia"
            ? "Todavía no conectaste tu cuenta de Tiendanube."
            : `Error: ${error}`}
        </p>
        <a href="/api/auth/tiendanube" style={{ color: "#00838f" }}>
          Conectar cuenta de Tiendanube →
        </a>
      </div>
    );
  }

  if (!orders) {
    return (
      <div>
        <h1>Tiendanube</h1>
        <p style={{ color: "#666" }}>Cargando pedidos...</p>
      </div>
    );
  }

  const paidOrders = orders.filter((o) => o.payment_status === "paid");
  const totalRevenue = paidOrders.reduce(
    (sum, o) => sum + parseFloat(o.total || 0),
    0
  );
  const avgTicket = paidOrders.length ? totalRevenue / paidOrders.length : 0;
  const currency = orders[0]?.currency || "ARS";

  // Agrupar por dia (fecha de creacion, YYYY-MM-DD)
  const byDay = {};
  for (const o of paidOrders) {
    const day = (o.created_at || "").slice(0, 10);
    if (!byDay[day]) byDay[day] = { count: 0, total: 0 };
    byDay[day].count += 1;
    byDay[day].total += parseFloat(o.total || 0);
  }
  const days = Object.entries(byDay).sort((a, b) => (a[0] < b[0] ? 1 : -1));

  return (
    <div>
      <h1>Tiendanube</h1>

      <div style={{ display: "flex", gap: "1rem", margin: "1.5rem 0" }}>
        <div style={cardStyle}>
          <div style={{ color: "#888", fontSize: 13 }}>Ventas totales</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>
            {formatMoney(totalRevenue, currency)}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ color: "#888", fontSize: 13 }}>Pedidos pagados</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>
            {paidOrders.length}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ color: "#888", fontSize: 13 }}>Ticket promedio</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>
            {formatMoney(avgTicket, currency)}
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: 16, marginTop: "2rem" }}>Ventas por día</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.5rem" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e2e2" }}>
            <th style={{ padding: "8px 4px" }}>Día</th>
            <th style={{ padding: "8px 4px" }}>Pedidos</th>
            <th style={{ padding: "8px 4px" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {days.map(([day, data]) => (
            <tr key={day} style={{ borderBottom: "1px solid #f0f0f0" }}>
              <td style={{ padding: "8px 4px" }}>{day}</td>
              <td style={{ padding: "8px 4px" }}>{data.count}</td>
              <td style={{ padding: "8px 4px" }}>
                {formatMoney(data.total, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
