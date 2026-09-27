"use client";

import { useState } from "react";
import { WEEKDAYS_ES, stockStatus } from "@/lib/tiendanubeMetrics";
import { formatMoney, formatPercent } from "../format";
import Thumb from "../Thumb";

/**
 * Ranking de productos con imagen. Click en uno filtra la lista de pedidos
 * a los que lo incluyen.
 */
export function TopProducts({ products, totalRevenue, currency, selectedKey, onSelect, stock, days }) {
  const [sortBy, setSortBy] = useState("revenue");
  const [showAll, setShowAll] = useState(false);
  const sorted = [...products].sort((a, b) => b[sortBy] - a[sortBy]);
  const visible = showAll ? sorted : sorted.slice(0, 8);
  const max = Math.max(1, ...sorted.map((p) => p[sortBy]));

  return (
    <div className="card">
      <div className="section-head">
        <div>
          <h2>Productos más vendidos</h2>
          <div className="section-sub">
            {products.length} productos distintos vendidos · click para ver sus pedidos
          </div>
        </div>
        <div className="segmented">
          <button className={sortBy === "revenue" ? "active" : ""} onClick={() => setSortBy("revenue")}>
            Ingresos
          </button>
          <button className={sortBy === "units" ? "active" : ""} onClick={() => setSortBy("units")}>
            Unidades
          </button>
        </div>
      </div>

      {visible.length === 0 && <div className="empty-state">Sin ventas pagadas en este período.</div>}

      <div className="product-list">
        {visible.map((p, i) => (
          <div
            key={p.key}
            className={"product-row" + (selectedKey === p.key ? " selected" : "")}
            onClick={() => onSelect(selectedKey === p.key ? null : p.key)}
          >
            <span className="rank mono">{i + 1}</span>
            <Thumb src={p.image} alt={p.name} />
            <div className="product-info">
              <div className="product-name">{p.name}</div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(p[sortBy] / max) * 100}%` }} />
              </div>
              {p.variants.length > 0 && (
                <div className="product-variants">
                  {p.variants.slice(0, 4).map(([v, q]) => (
                    <span key={v} className="chip">
                      {v} <b>×{q}</b>
                    </span>
                  ))}
                  {p.variants.length > 4 && <span className="chip">+{p.variants.length - 4}</span>}
                </div>
              )}
              <StockChip status={stockStatus(p.key, p.units, days, stock)} />
            </div>
            <div className="product-stats mono">
              <div className="strong">{formatMoney(p.revenue, currency)}</div>
              <div>
                {p.units} u. · {p.orders} ped.
              </div>
              <div className="muted">
                {totalRevenue ? formatPercent(p.revenue / totalRevenue, 1) : "—"} del total
              </div>
            </div>
          </div>
        ))}
      </div>

      {sorted.length > 8 && (
        <button className="link-btn" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Ver menos" : `Ver los ${sorted.length} productos`}
        </button>
      )}
    </div>
  );
}

function StockChip({ status }) {
  if (!status || status.level === "unlimited") return null;
  const text =
    status.level === "out"
      ? "Sin stock"
      : `Stock: ${status.stock} u.` + (status.daysLeft !== null ? ` · ≈${Math.round(status.daysLeft)} días` : "");
  return (
    <div className="product-variants">
      <span className={`chip stock-${status.level}`}>{text}</span>
      {status.level !== "out" && status.outVariants.length > 0 && (
        <span className="chip stock-low" title={status.outVariants.join(", ")}>
          {status.outVariants.length} {status.outVariants.length === 1 ? "variante agotada" : "variantes agotadas"}
        </span>
      )}
    </div>
  );
}

/** Desglose con pestanas: cada una es una lista de barras horizontales */
export function Breakdowns({ tabs, currency }) {
  const [active, setActive] = useState(tabs[0].key);
  const tab = tabs.find((t) => t.key === active) || tabs[0];
  const rows = tab.rows.slice(0, 8);
  const total = tab.rows.reduce((s, r) => s + r.revenue, 0);
  const max = Math.max(1, ...rows.map((r) => r.revenue));

  return (
    <div className="card">
      <div className="section-head">
        <h2>Desglose de ventas</h2>
      </div>
      <div className="tabs">
        {tabs.map((t) => (
          <button key={t.key} className={t.key === active ? "active" : ""} onClick={() => setActive(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {rows.length === 0 && <div className="empty-state">{tab.empty || "Sin datos."}</div>}
      {rows.map((r) => (
        <div key={r.label} className="breakdown-row">
          <div className="breakdown-top">
            <span className="breakdown-label" title={r.email || r.label}>
              {r.label}
            </span>
            <span className="mono">
              {formatMoney(r.revenue, currency)}
              <span className="muted"> · {r.count} ped. · {total ? formatPercent(r.revenue / total) : "—"}</span>
            </span>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(r.revenue / max) * 100}%` }} />
          </div>
        </div>
      ))}
      {tab.note && <div className="section-sub" style={{ marginTop: 8 }}>{tab.note}</div>}
    </div>
  );
}

/** Mapa de calor dia de semana x hora: cuando compran los clientes */
export function SalesHeatmap({ grid }) {
  const max = Math.max(1, ...grid.flat());
  const byHour = Array.from({ length: 24 }, (_, h) => grid.reduce((s, row) => s + row[h], 0));
  const byDay = grid.map((row) => row.reduce((s, v) => s + v, 0));
  const peakHour = byHour.indexOf(Math.max(...byHour));
  const peakDay = byDay.indexOf(Math.max(...byDay));
  const hasData = byDay.some((v) => v > 0);

  return (
    <div className="card">
      <div className="section-head">
        <div>
          <h2>¿Cuándo compran?</h2>
          <div className="section-sub">
            {hasData
              ? `Pico: ${WEEKDAYS_ES[peakDay]} y entre ${peakHour}:00 y ${peakHour + 1}:00 hs. Útil para programar anuncios.`
              : "Sin ventas pagadas en este período."}
          </div>
        </div>
      </div>
      <div className="heatmap">
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="heatmap-hour">
            {h % 3 === 0 ? h : ""}
          </div>
        ))}
        {grid.map((row, d) => (
          <FragmentRow key={d} day={WEEKDAYS_ES[d]} row={row} max={max} />
        ))}
      </div>
    </div>
  );
}

function FragmentRow({ day, row, max }) {
  return (
    <>
      <div className="heatmap-day">{day}</div>
      {row.map((v, h) => (
        <div
          key={h}
          className="heatmap-cell"
          title={`${day} ${h}:00 — ${v} ${v === 1 ? "venta" : "ventas"}`}
          style={{ opacity: v === 0 ? 1 : 0.2 + 0.8 * (v / max), background: v === 0 ? undefined : "var(--accent)" }}
        />
      ))}
    </>
  );
}
