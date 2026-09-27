"use client";

import { useState } from "react";
import { formatDayLabel } from "./format";

const W = 800;
const H = 240;
const PAD = { top: 12, right: 8, bottom: 26, left: 8 };

/**
 * Barras (serie principal) + linea (serie secundaria) en la misma escala,
 * por dia. Pensado para facturacion vs inversion: al compartir escala se
 * ve de un vistazo cuanto "rinde" cada peso invertido.
 *
 * - bars / line: { key, label, format }
 * - renderTooltip(d): contenido extra del tooltip
 */
export default function ComboChart({ title, subtitle, series, bars, line, renderTooltip }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1e-9, ...series.map((d) => Math.max(d[bars.key] || 0, d[line.key] || 0)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / Math.max(1, series.length);
  const barW = Math.max(1, slot * 0.66);
  const labelEvery = Math.ceil(series.length / 10);
  const y = (v) => PAD.top + innerH - ((v || 0) / max) * innerH;
  const x = (i) => PAD.left + i * slot + slot / 2;
  const points = series.map((d, i) => `${x(i)},${y(d[line.key])}`).join(" ");
  const hovered = hover !== null ? series[hover] : null;

  return (
    <div className="card chart-card">
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <div className="section-sub">{subtitle}</div>}
        </div>
        <div className="chart-legend">
          <span>
            <i className="legend-bar" /> {bars.label}
          </span>
          <span>
            <i className="legend-line" /> {line.label}
          </span>
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
            const v = d[bars.key] || 0;
            return (
              <g key={d.day}>
                <rect
                  x={PAD.left + i * slot}
                  y={PAD.top}
                  width={slot}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                />
                <rect
                  x={x(i) - barW / 2}
                  y={y(v)}
                  width={barW}
                  height={Math.max(PAD.top + innerH - y(v), v > 0 ? 2 : 0)}
                  rx={Math.min(3, barW / 2)}
                  className={"chart-bar" + (hover === i ? " hovered" : "")}
                  pointerEvents="none"
                />
                {i % labelEvery === 0 && (
                  <text x={x(i)} y={H - 8} textAnchor="middle" className="chart-label">
                    {formatDayLabel(d.day, true)}
                  </text>
                )}
              </g>
            );
          })}
          <polyline points={points} className="chart-line" pointerEvents="none" />
          {hovered && <circle cx={x(hover)} cy={y(hovered[line.key])} r={4} className="chart-dot" />}
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
              left: `${(x(hover) / W) * 100}%`,
              transform:
                hover > series.length * 0.7 ? "translateX(-100%)" : hover < series.length * 0.3 ? "none" : "translateX(-50%)",
            }}
          >
            <div className="tt-title">{formatDayLabel(hovered.day)}</div>
            <div>
              {bars.label}: {bars.format(hovered[bars.key] || 0)}
            </div>
            <div>
              {line.label}: {line.format(hovered[line.key] || 0)}
            </div>
            {renderTooltip && <div className="tt-muted">{renderTooltip(hovered)}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
