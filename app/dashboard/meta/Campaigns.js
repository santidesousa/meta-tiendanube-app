"use client";

import { useState } from "react";
import { formatMoney, formatNumber, formatPercent } from "../format";
import { objectiveResult } from "@/lib/metaObjectives";
import { roasClass } from "./Breakdowns";
import { CsvButton, downloadCsv } from "../csv";

const STATUS = {
  ACTIVE: { label: "Activa", cls: "badge-active" },
  PAUSED: { label: "Pausada", cls: "badge-paused" },
  CAMPAIGN_PAUSED: { label: "Campaña pausada", cls: "badge-paused" },
  ADSET_PAUSED: { label: "Conjunto pausado", cls: "badge-paused" },
  IN_PROCESS: { label: "Procesando", cls: "badge-other" },
  PENDING_REVIEW: { label: "En revisión", cls: "badge-other" },
  DISAPPROVED: { label: "Rechazado", cls: "badge-danger" },
  WITH_ISSUES: { label: "Con problemas", cls: "badge-danger" },
  ARCHIVED: { label: "Archivada", cls: "badge-other" },
  DELETED: { label: "Eliminada", cls: "badge-other" },
};

export function StatusBadge({ status }) {
  if (!status) return null;
  const s = STATUS[status] || { label: status, cls: "badge-other" };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

const FILTERS = [
  { key: "SPEND", label: "Con inversión", test: (c) => c.m.spend > 0 },
  { key: "ACTIVE", label: "Activas", test: (c) => c.status === "ACTIVE" },
  { key: "PAUSED", label: "Pausadas", test: (c) => c.status === "PAUSED" },
  { key: "ALL", label: "Todas", test: () => true },
];

// "Resultados" y su costo dependen del objetivo de cada campana (compras,
// anadidos al carrito o clics): ver lib/metaObjectives.js.
const COLUMNS = [
  { key: "spend", label: "Inversión" },
  { key: "result", label: "Resultados" },
  { key: "costPerResult", label: "Costo/res.", asc: true },
  { key: "roas", label: "ROAS" },
  { key: "ctr", label: "CTR" },
  { key: "cpm", label: "CPM", asc: true },
];

/**
 * Tabla de campanas con metricas del periodo. Click en una fila filtra los
 * anuncios de abajo a esa campana.
 */
export default function Campaigns({ campaigns, totalSpend, currency, selectedId, onSelect }) {
  const [filter, setFilter] = useState("SPEND");
  const [sort, setSort] = useState({ key: "spend", dir: -1 });

  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, campaigns.filter(f.test).length]));
  const value = (c, key) => (key === "result" || key === "costPerResult" ? c.obj[key] : c.m[key]);
  const rows = campaigns
    .map((c) => ({ ...c, obj: objectiveResult(c.objectiveType, c.m) }))
    .filter(FILTERS.find((f) => f.key === filter).test)
    .sort((a, b) => {
      const va = value(a, sort.key);
      const vb = value(b, sort.key);
      // Los vacios (sin compras => sin CPA) siempre al final.
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      return (va - vb) * sort.dir;
    });

  function toggleSort(col) {
    setSort((s) => (s.key === col.key ? { key: col.key, dir: -s.dir } : { key: col.key, dir: col.asc ? 1 : -1 }));
  }

  return (
    <div className="card">
      <div className="section-head">
        <div>
          <h2>Campañas</h2>
          <div className="section-sub">Click en una campaña para ver sus anuncios · click en una columna para ordenar</div>
        </div>
        <CsvButton
          onClick={() =>
            downloadCsv("campanas-meta", [
              { label: "Campaña", value: (c) => c.name },
              { label: "Estado", value: (c) => c.status },
              { label: "Objetivo", value: (c) => c.obj.def.label },
              { label: "Resultados (según objetivo)", value: (c) => c.obj.result },
              { label: "Tipo de resultado", value: (c) => c.obj.def.resultLabel },
              { label: "Costo por resultado", value: (c) => c.obj.costPerResult },
              { label: "Presupuesto diario", value: (c) => c.dailyBudget },
              { label: "Inversión", value: (c) => c.m.spend },
              { label: "Impresiones", value: (c) => c.m.impressions },
              { label: "Clicks enlace", value: (c) => c.m.linkClicks },
              { label: "CTR", value: (c) => c.m.ctr },
              { label: "CPM", value: (c) => c.m.cpm },
              { label: "Compras", value: (c) => c.m.purchases },
              { label: "CPA", value: (c) => c.m.cpa },
              { label: "Valor compras", value: (c) => (c.m.hasPurchaseValue ? c.m.purchaseValue : null) },
              { label: "ROAS", value: (c) => c.m.roas },
            ], rows)
          }
        />
      </div>
      <div className="filter-row" style={{ flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <div
            key={f.key}
            className={"filter-pill" + (filter === f.key ? " active" : "")}
            onClick={() => setFilter(f.key)}
          >
            {f.label} ({counts[f.key]})
          </div>
        ))}
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Campaña</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="sortable" style={{ textAlign: "right" }} onClick={() => toggleSort(c)}>
                  {c.label}
                  {sort.key === c.key ? (sort.dir === -1 ? " ↓" : " ↑") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr
                key={c.id}
                className={
                  "row-clickable" + (c.obj.noResult ? " row-alert" : "") + (selectedId === c.id ? " row-selected" : "")
                }
                onClick={() => onSelect(selectedId === c.id ? null : c.id)}
              >
                <td>
                  <div className="strong">{c.name}</div>
                  <div className="small muted" style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
                    <StatusBadge status={c.status} />
                    <span className={`objective-chip obj-${c.obj.type}`}>{c.obj.def.label}</span>
                    {c.dailyBudget ? ` · ${formatMoney(c.dailyBudget, currency)}/día` : ""}
                  </div>
                </td>
                <td className="mono" style={{ textAlign: "right" }}>
                  {formatMoney(c.m.spend, currency)}
                  <div className="small muted">{totalSpend ? formatPercent(c.m.spend / totalSpend) : ""}</div>
                </td>
                <td className={"mono" + (c.obj.noResult ? " text-bad" : "")} style={{ textAlign: "right" }}>
                  {formatNumber(c.obj.result)}
                  <div className="small muted">{c.obj.def.resultLabel.toLowerCase()}</div>
                </td>
                <td className="mono" style={{ textAlign: "right" }}>
                  {c.obj.costPerResult !== null ? formatMoney(c.obj.costPerResult, currency) : "—"}
                </td>
                <td className={"mono " + roasClass(c.m.roas)} style={{ textAlign: "right" }}>
                  {c.m.roas !== null ? `${c.m.roas.toFixed(2)}x` : "—"}
                </td>
                <td className="mono" style={{ textAlign: "right" }}>
                  {c.m.impressions ? formatPercent(c.m.ctr, 2) : "—"}
                </td>
                <td className="mono" style={{ textAlign: "right" }}>
                  {c.m.cpm !== null ? formatMoney(c.m.cpm, currency) : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-state">
                  No hay campañas con este filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
