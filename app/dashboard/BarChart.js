"use client";

import { useState } from "react";
import { formatDayLabel } from "./format";

const W = 800;
const H = 220;
const PAD = { top: 12, right: 8, bottom: 26, left: 8 };

/**
 * Grafico de barras por dia, con selector de metrica, tooltip y (opcional)
 * click en un dia para seleccionarlo.
 *
 * - series: [{ day: "YYYY-MM-DD", ...valores }]
 * - metrics: [{ key, label, format(v) }]
 * - renderTooltip(d): contenido del tooltip para un dia
 * - summary(metric): texto bajo el titulo para la metrica activa
 */
export default function BarChart({
  title,
  series,
  metrics,
  renderTooltip,
  summary,
  selectedDay,
  onSelectDay,
  hint,
}) {
  const [metricKey, setMetricKey] = useState(metrics[0].key);
  const [hover, setHover] = useState(null);
  const metric = metrics.find((m) => m.key === metricKey) || metrics[0];

  const values = series.map((d) => d[metric.key] || 0);
  const max = Math.max(1e-9, ...values);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / Math.max(1, series.length);
  const barW = Math.max(1, slot * 0.72);
  const labelEvery = Math.ceil(series.length / 10);
  const hovered = hover !== null ? series[hover] : null;

  return (
    <div className="card chart-card">
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          {summary && <div className="section-sub">{summary(metric)}</div>}
        </div>
        <div className="segmented">
          {metrics.map((m) => (
            <button key={m.key} className={metric.key === m.key ? "active" : ""} onClick={() => setMetricKey(m.key)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-wrap" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label={title}>
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
            const v = values[i];
            const h = (v / max) * innerH;
            const x = PAD.left + i * slot + (slot - barW) / 2;
            const isSelected = selectedDay === d.day;
            const dimmed = selectedDay && !isSelected;
            return (
              <g key={d.day}>
                <rect
                  x={PAD.left + i * slot}
                  y={PAD.top}
                  width={slot}
                  height={innerH}
                  fill="transparent"
                  style={{ cursor: onSelectDay ? "pointer" : "default" }}
                  onMouseEnter={() => setHover(i)}
                  onClick={() => onSelectDay?.(isSelected ? null : d.day)}
                />
                <rect
                  x={x}
                  y={PAD.top + innerH - h}
                  width={barW}
                  height={Math.max(h, v > 0 ? 2 : 0)}
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
                  <text x={PAD.left + i * slot + slot / 2} y={H - 8} textAnchor="middle" className="chart-label">
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
              transform:
                hover > series.length * 0.7
                  ? "translateX(-100%)"
                  : hover < series.length * 0.3
                  ? "none"
                  : "translateX(-50%)",
            }}
          >
            <div className="tt-title">{formatDayLabel(hovered.day)}</div>
            {renderTooltip(hovered)}
            {hint && <div className="tt-hint">{hint}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
