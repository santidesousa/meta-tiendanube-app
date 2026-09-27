"use client";

import { useState } from "react";
import { formatMoney, formatDayLabel } from "./format";

const METRICS = [
  { key: "revenue", label: "Facturación" },
  { key: "orders", label: "Pedidos" },
  { key: "units", label: "Unidades" },
];

const W = 800;
const H = 220;
const PAD = { top: 12, right: 8, bottom: 26, left: 8 };

/**
 * Barras de ventas por dia. Hover muestra el detalle del dia; click filtra
 * la lista de pedidos a ese dia (y un segundo click lo saca).
 */
export default function SalesChart({ series, currency, selectedDay, onSelectDay }) {
  const [metric, setMetric] = useState("revenue");
  const [hover, setHover] = useState(null);

  const max = Math.max(1, ...series.map((d) => d[metric]));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / series.length;
  const barW = Math.max(1, slot * 0.72);
  // Cuantas etiquetas del eje X mostrar sin que se pisen.
  const labelEvery = Math.ceil(series.length / 10);

  const fmt = (v) => (metric === "revenue" ? formatMoney(v, currency) : v.toLocaleString("es-AR"));
  const hovered = hover !== null ? series[hover] : null;
  const total = series.reduce((s, d) => s + d[metric], 0);
  const best = series.reduce((a, b) => (b[metric] > a[metric] ? b : a), series[0]);

  return (
    <div className="card chart-card">
      <div className="section-head">
        <div>
          <h2>Ventas por día</h2>
          <div className="section-sub">
            Total {fmt(total)}
            {best && best[metric] > 0 && ` · mejor día ${formatDayLabel(best.day)} (${fmt(best[metric])})`}
          </div>
        </div>
        <div className="segmented">
          {METRICS.map((m) => (
            <button
              key={m.key}
              className={metric === m.key ? "active" : ""}
              onClick={() => setMetric(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-wrap" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label="Ventas por día">
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1={PAD.left}
              x2={W - PAD.right}
              y1={PAD.top + innerH * (1 - f)}
              y2={PAD.top + innerH * (1 - f)}
              className="chart-grid"
            />
          ))}
          {series.map((d, i) => {
            const h = (d[metric] / max) * innerH;
            const x = PAD.left + i * slot + (slot - barW) / 2;
            const isSelected = selectedDay === d.day;
            const dimmed = selectedDay && !isSelected;
            return (
              <g key={d.day}>
                {/* area de hover/click de todo el alto, para dias con 0 tambien */}
                <rect
                  x={PAD.left + i * slot}
                  y={PAD.top}
                  width={slot}
                  height={innerH}
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHover(i)}
                  onClick={() => onSelectDay(isSelected ? null : d.day)}
                />
                <rect
                  x={x}
                  y={PAD.top + innerH - h}
                  width={barW}
                  height={Math.max(h, d[metric] > 0 ? 2 : 0)}
                  rx={Math.min(3, barW / 2)}
                  className={
                    "chart-bar" +
                    (isSelected ? " selected" : "") +
                    (dimmed ? " dimmed" : "") +
                    (hover === i ? " hovered" : "")
                  }
                  pointerEvents="none"
                />
                {i % labelEvery === 0 && (
                  <text
                    x={PAD.left + i * slot + slot / 2}
                    y={H - 8}
                    textAnchor="middle"
                    className="chart-label"
                  >
                    {formatDayLabel(d.day, true)}
                  </text>
                )}
              </g>
            );
          })}
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={PAD.top + innerH}
            y2={PAD.top + innerH}
            className="chart-axis"
          />
        </svg>

        {hovered && (
          <div
            className="chart-tooltip"
            style={{
              left: `${((PAD.left + hover * slot + slot / 2) / W) * 100}%`,
              transform: hover > series.length * 0.7 ? "translateX(-100%)" : hover < series.length * 0.3 ? "none" : "translateX(-50%)",
            }}
          >
            <div className="tt-title">{formatDayLabel(hovered.day)}</div>
            <div>{formatMoney(hovered.revenue, currency)}</div>
            <div className="tt-muted">
              {hovered.orders} {hovered.orders === 1 ? "pedido" : "pedidos"} · {hovered.units} u.
            </div>
            <div className="tt-hint">Click para ver sus pedidos</div>
          </div>
        )}
      </div>
    </div>
  );
}
