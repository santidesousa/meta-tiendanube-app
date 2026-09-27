"use client";

import BarChart from "../BarChart";
import { formatMoney, formatDayLabel } from "../format";

/**
 * Ventas por dia. Click en un dia filtra la lista de pedidos a ese dia
 * (y un segundo click lo saca).
 */
export default function SalesChart({ series, currency, selectedDay, onSelectDay }) {
  const count = (v) => v.toLocaleString("es-AR");
  const metrics = [
    { key: "revenue", label: "Facturación", format: (v) => formatMoney(v, currency) },
    { key: "orders", label: "Pedidos", format: count },
    { key: "units", label: "Unidades", format: count },
  ];

  return (
    <BarChart
      title="Ventas por día"
      series={series}
      metrics={metrics}
      selectedDay={selectedDay}
      onSelectDay={onSelectDay}
      hint="Click para ver sus pedidos"
      summary={(m) => {
        const total = series.reduce((s, d) => s + d[m.key], 0);
        const best = series.reduce((a, b) => (b[m.key] > a[m.key] ? b : a), series[0]);
        return (
          `Total ${m.format(total)}` +
          (best && best[m.key] > 0 ? ` · mejor día ${formatDayLabel(best.day)} (${m.format(best[m.key])})` : "")
        );
      }}
      renderTooltip={(d) => (
        <>
          <div>{formatMoney(d.revenue, currency)}</div>
          <div className="tt-muted">
            {d.orders} {d.orders === 1 ? "pedido" : "pedidos"} · {d.units} u.
          </div>
        </>
      )}
    />
  );
}
