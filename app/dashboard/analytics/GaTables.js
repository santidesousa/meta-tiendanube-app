"use client";

import { useEffect, useState } from "react";
import { formatDuration, withGaRatios } from "@/lib/gaMetrics";
import { fetchJson } from "../api";
import { CsvButton, downloadCsv } from "../csv";
import { formatMoney, formatNumber, formatPercent } from "../format";

// Columnas de las tablas de trafico (canales, fuentes, campanas...).
function trafficColumns(currency) {
  return [
    { label: "Usuarios", value: (r) => r.users, format: formatNumber },
    { label: "Interacción", value: (r) => r.engagementRate, format: (v) => formatPercent(v, 1) },
    { label: "Compras", value: (r) => r.purchases, format: formatNumber },
    { label: "Ingresos", value: (r) => r.revenue, format: (v) => formatMoney(v, currency) },
    { label: "Conversión", value: (r) => r.conversionRate, format: (v) => formatPercent(v, 2) },
  ];
}

const PAGE_COLUMNS = [
  { label: "Vistas", value: (r) => r.views, format: formatNumber },
  { label: "Usuarios", value: (r) => r.users, format: formatNumber },
  { label: "Vistas por usuario", value: (r) => (r.users ? r.views / r.users : null), format: (v) => v.toFixed(1) },
  { label: "Tiempo medio", value: (r) => r.avgEngagementTime, format: formatDuration },
];

function productColumns(currency) {
  return [
    { label: "Vistos", value: (r) => r.itemsViewed, format: formatNumber },
    { label: "Al carrito", value: (r) => r.itemsAddedToCart, format: formatNumber },
    { label: "Comprados", value: (r) => r.itemsPurchased, format: formatNumber },
    { label: "Ingresos", value: (r) => r.itemRevenue, format: (v) => formatMoney(v, currency) },
    {
      label: "Visto → compra",
      value: (r) => (r.itemsViewed ? r.itemsPurchased / r.itemsViewed : null),
      format: (v) => formatPercent(v, 1),
    },
  ];
}

/**
 * Tabla generica: primera columna con nombre (y subtitulo opcional) + barra
 * de participacion sobre `shareKey`, y el resto de columnas numericas.
 */
function DataTable({ rows, firstLabel, shareKey, shareLabel, shareFormat, columns, csvName }) {
  const total = rows.reduce((s, r) => s + (r[shareKey] || 0), 0);
  const max = Math.max(1, ...rows.map((r) => r[shareKey] || 0));

  function exportCsv() {
    downloadCsv(csvName, [
      { label: firstLabel, value: (r) => (r.sub ? `${r.label} (${r.sub})` : r.label) },
      { label: shareLabel, value: (r) => r[shareKey] },
      ...columns.map((c) => ({ label: c.label, value: c.value })),
    ], rows);
  }

  if (rows.length === 0) return <div className="empty-state">Sin datos para este período.</div>;

  return (
    <>
      <div className="table-tools">
        <CsvButton onClick={exportCsv} />
      </div>
      <div className="table-scroll" style={{ maxHeight: 460, overflowY: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>{firstLabel}</th>
              <th style={{ width: "22%" }}>{shareLabel}</th>
              {columns.map((c) => (
                <th key={c.label} style={{ textAlign: "right" }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.label}-${r.sub || ""}-${i}`}>
                <td style={{ maxWidth: 280 }}>
                  <div className="ellipsis" title={r.label}>
                    {r.label}
                  </div>
                  {r.sub && (
                    <div className="small muted mono ellipsis" title={r.sub}>
                      {r.sub}
                    </div>
                  )}
                </td>
                <td>
                  <div className="mono small">
                    {shareFormat(r[shareKey] || 0)}{" "}
                    <span className="muted">{total ? formatPercent((r[shareKey] || 0) / total) : ""}</span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${((r[shareKey] || 0) / max) * 100}%` }} />
                  </div>
                </td>
                {columns.map((c) => {
                  const v = c.value(r);
                  return (
                    <td key={c.label} className="mono" style={{ textAlign: "right" }}>
                      {v === null || v === undefined || !isFinite(v) ? "—" : c.format(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Canales (ya vienen en el overview) */
export function ChannelsTable({ channels, currency }) {
  const rows = channels.map(withGaRatios);
  return (
    <div className="card">
      <div className="section-head">
        <div>
          <h2>¿De dónde vienen?</h2>
          <div className="section-sub">Sesiones y ventas por canal (agrupación predeterminada de GA4)</div>
        </div>
      </div>
      <DataTable
        rows={rows}
        firstLabel="Canal"
        shareKey="sessions"
        shareLabel="Sesiones"
        shareFormat={formatNumber}
        columns={trafficColumns(currency)}
        csvName="ga-canales"
      />
    </div>
  );
}

const TABS = [
  { key: "source", label: "Fuente / medio", first: "Fuente / medio" },
  { key: "campaign", label: "Campañas", first: "Campaña (UTM)" },
  { key: "landing", label: "Páginas de entrada", first: "Página de entrada" },
  { key: "pages", label: "Páginas más vistas", first: "Página" },
  { key: "products", label: "Productos", first: "Producto" },
  { key: "device", label: "Dispositivos", first: "Dispositivo" },
  { key: "region", label: "Regiones", first: "Región" },
];

/** Desgloses que se piden recien al abrir cada pestana (y se guardan). */
export function GaBreakdowns({ range, currency }) {
  const [active, setActive] = useState("source");
  const [cache, setCache] = useState({});
  const cacheKey = `${active}|${range.since}|${range.until}`;
  const entry = cache[cacheKey];

  useEffect(() => {
    if (cache[cacheKey]) return;
    let cancelled = false;
    fetchJson(`/api/ga/breakdown?type=${active}&since=${range.since}&until=${range.until}`)
      .then((d) => !cancelled && setCache((c) => ({ ...c, [cacheKey]: { rows: d.rows } })))
      .catch((e) => !cancelled && setCache((c) => ({ ...c, [cacheKey]: { error: e.message } })));
    return () => {
      cancelled = true;
    };
  }, [cacheKey, cache, active, range]);

  const tab = TABS.find((t) => t.key === active);
  let table = null;
  if (entry?.rows) {
    if (active === "products") {
      table = (
        <DataTable
          rows={entry.rows}
          firstLabel={tab.first}
          shareKey="itemRevenue"
          shareLabel="Ingresos"
          shareFormat={(v) => formatMoney(v, currency)}
          columns={productColumns(currency).filter((c) => c.label !== "Ingresos")}
          csvName="ga-productos"
        />
      );
    } else if (active === "pages") {
      table = (
        <DataTable
          rows={entry.rows.map(withGaRatios)}
          firstLabel={tab.first}
          shareKey="views"
          shareLabel="Vistas"
          shareFormat={formatNumber}
          columns={PAGE_COLUMNS.filter((c) => c.label !== "Vistas")}
          csvName="ga-paginas"
        />
      );
    } else {
      table = (
        <DataTable
          rows={entry.rows.map(withGaRatios)}
          firstLabel={tab.first}
          shareKey="sessions"
          shareLabel="Sesiones"
          shareFormat={formatNumber}
          columns={trafficColumns(currency)}
          csvName={`ga-${active}`}
        />
      );
    }
  }

  return (
    <div className="card">
      <div className="section-head">
        <div>
          <h2>Detalle</h2>
          <div className="section-sub">
            {active === "campaign"
              ? "Campañas según los parámetros UTM de los links (incluye las de Meta si están etiquetadas)."
              : active === "products"
              ? "Requiere el seguimiento de e-commerce de GA4 (Tiendanube lo envía si la integración está activa)."
              : "Top 50 del período"}
          </div>
        </div>
      </div>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={t.key === active ? "active" : ""} onClick={() => setActive(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {!entry && <div className="skeleton" style={{ height: 220, borderRadius: 8 }} />}
      {entry?.error && <p style={{ color: "var(--danger)" }}>No se pudo cargar: {entry.error}</p>}
      {table}
    </div>
  );
}
