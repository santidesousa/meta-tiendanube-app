"use client";

import { useEffect, useState } from "react";
import { formatMoney, formatPercent } from "../format";
import { StatusBadge } from "./Campaigns";
import { roasClass } from "./Breakdowns";
import Funnel from "./Funnel";
import { CsvButton, downloadCsv } from "../csv";

const SORTS = [
  { key: "spend", label: "Inversión" },
  { key: "purchases", label: "Compras" },
  { key: "roas", label: "ROAS" },
  { key: "cpa", label: "CPA", asc: true },
  { key: "ctr", label: "CTR" },
];

const FILTERS = [
  { key: "ALL", label: "Todos", test: () => true },
  { key: "SALES", label: "Con ventas", test: (a) => a.m.purchases > 0 },
  { key: "ALERT", label: "Gastan sin vender", test: (a) => a.m.noResults },
  { key: "FATIGUE", label: "Con fatiga", test: (a) => a.m.fatigue },
];

function exportAds(rows) {
  downloadCsv("anuncios-meta", [
    { label: "Anuncio", value: (a) => a.name },
    { label: "Campaña", value: (a) => a.campaignName },
    { label: "Conjunto", value: (a) => a.adsetName },
    { label: "Estado", value: (a) => a.status },
    { label: "Inversión", value: (a) => a.m.spend },
    { label: "Impresiones", value: (a) => a.m.impressions },
    { label: "Frecuencia", value: (a) => a.m.frequency },
    { label: "Clicks enlace", value: (a) => a.m.linkClicks },
    { label: "CTR", value: (a) => a.m.ctr },
    { label: "CPC", value: (a) => a.m.cpc },
    { label: "Compras", value: (a) => a.m.purchases },
    { label: "CPA", value: (a) => a.m.cpa },
    { label: "Valor compras", value: (a) => (a.m.hasPurchaseValue ? a.m.purchaseValue : null) },
    { label: "ROAS", value: (a) => a.m.roas },
  ], rows);
}

/**
 * Grilla de creatividades con sus metricas del periodo. `campaignFilter`
 * viene de la tabla de campanas.
 */
export default function Ads({ ads, currency, campaignFilter, onClearCampaign, openAd, onOpenAd }) {
  const [sortKey, setSortKey] = useState("spend");
  const [filter, setFilter] = useState("ALL");
  const [limit, setLimit] = useState(12);

  useEffect(() => setLimit(12), [campaignFilter, filter, sortKey]);

  const base = campaignFilter ? ads.filter((a) => a.campaignId === campaignFilter.id) : ads;
  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, base.filter(f.test).length]));
  const sort = SORTS.find((s) => s.key === sortKey);
  const rows = base
    .filter(FILTERS.find((f) => f.key === filter).test)
    .sort((a, b) => {
      const va = a.m[sortKey];
      const vb = b.m[sortKey];
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      return sort.asc ? va - vb : vb - va;
    });

  return (
    <div className="card" id="anuncios">
      <div className="section-head">
        <div>
          <h2>Anuncios</h2>
          <div className="section-sub">
            {rows.length} anuncios con actividad en el período · click para ver el detalle
          </div>
        </div>
        <div className="section-tools">
        <CsvButton onClick={() => exportAds(rows)} />
        <div className="segmented">
          {SORTS.map((s) => (
            <button key={s.key} className={sortKey === s.key ? "active" : ""} onClick={() => setSortKey(s.key)}>
              {s.label}
            </button>
          ))}
        </div>
        </div>
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
        {campaignFilter && (
          <div className="filter-chip" onClick={onClearCampaign}>
            Campaña: {campaignFilter.name} <span aria-label="Quitar filtro">×</span>
          </div>
        )}
      </div>

      {rows.length === 0 && <div className="empty-state">No hay anuncios con este filtro.</div>}

      <div className="ad-grid">
        {rows.slice(0, limit).map((ad) => (
          <AdCard key={ad.id} ad={ad} currency={currency} onClick={() => onOpenAd(ad)} />
        ))}
      </div>

      {rows.length > limit && (
        <button className="link-btn" onClick={() => setLimit(limit + 12)}>
          Ver más ({rows.length - limit} restantes)
        </button>
      )}

      {openAd && <AdDrawer ad={openAd} currency={currency} onClose={() => onOpenAd(null)} />}
    </div>
  );
}

function AdCard({ ad, currency, onClick }) {
  const m = ad.m;
  return (
    <div className={"ad-card" + (m.noResults ? " ad-card-alert" : "")} onClick={onClick}>
      <div className="ad-image">
        {ad.image ? <img src={ad.image} alt={ad.name} loading="lazy" /> : <div className="ad-noimage">Sin imagen</div>}
        {ad.isVideo && <span className="ad-video-tag">▶ Video</span>}
        {m.fatigue && <span className="ad-fatigue-tag">Fatiga · frec. {m.frequency.toFixed(1)}</span>}
      </div>
      <div className="ad-body">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
          <div className="ad-name" title={ad.name}>
            {ad.name}
          </div>
          <StatusBadge status={ad.status} />
        </div>
        <div className="small muted ad-campaign" title={ad.campaignName}>
          {ad.campaignName}
        </div>
        <div className="ad-metrics">
          <Metric label="Inversión" value={formatMoney(m.spend, currency)} />
          <Metric label="Compras" value={m.purchases} tone={m.noResults ? "bad" : m.purchases > 0 ? "good" : ""} />
          <Metric label="CPA" value={m.cpa !== null ? formatMoney(m.cpa, currency) : "—"} tone={m.noResults ? "bad" : ""} />
          <Metric
            label="ROAS"
            value={m.roas !== null ? `${m.roas.toFixed(2)}x` : "—"}
            tone={m.roas === null ? "" : m.roas >= 1 ? "good" : "bad"}
          />
          <Metric label="CTR" value={formatPercent(m.ctr, 2)} />
          <Metric label="CPC" value={m.cpc !== null ? formatMoney(m.cpc, currency) : "—"} />
        </div>
        {m.noResults && <div className="alert-note">⚠ Gastó {formatMoney(m.spend, currency)} sin ventas</div>}
      </div>
    </div>
  );
}

function Metric({ label, value, tone }) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <span className={"metric-value" + (tone ? ` ${tone}` : "")}>{value}</span>
    </div>
  );
}

function AdDrawer({ ad, currency, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const m = ad.m;
  const rows = [
    ["Inversión", formatMoney(m.spend, currency)],
    ["Impresiones", Math.round(m.impressions).toLocaleString("es-AR")],
    ["Frecuencia", m.frequency !== null && m.frequency !== undefined ? m.frequency.toFixed(2) : "—"],
    ["Clicks en el enlace", Math.round(m.linkClicks).toLocaleString("es-AR")],
    ["CTR (enlace)", formatPercent(m.ctr, 2)],
    ["CPC", m.cpc !== null ? formatMoney(m.cpc, currency) : "—"],
    ["CPM", m.cpm !== null ? formatMoney(m.cpm, currency) : "—"],
    ["Compras", m.purchases],
    ["CPA", m.cpa !== null ? formatMoney(m.cpa, currency) : "—"],
    ["Valor de compras", m.hasPurchaseValue ? formatMoney(m.purchaseValue, currency) : "—"],
    ["ROAS", m.roas !== null ? `${m.roas.toFixed(2)}x` : "—"],
    ["Conversión (click → compra)", m.convRate !== null ? formatPercent(m.convRate, 2) : "—"],
  ];

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div style={{ minWidth: 0 }}>
            <h2>{ad.name}</h2>
            <div className="muted small">
              {ad.campaignName}
              {ad.adsetName ? ` · ${ad.adsetName}` : ""}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <div style={{ marginBottom: 12 }}>
          <StatusBadge status={ad.status} />
        </div>

        {ad.image && <img className="drawer-creative" src={ad.image} alt={ad.name} />}
        {(ad.title || ad.body) && (
          <div className="drawer-block" style={{ marginTop: 10 }}>
            {ad.title && <div className="strong">{ad.title}</div>}
            {ad.body && <div className="muted" style={{ whiteSpace: "pre-line" }}>{ad.body}</div>}
          </div>
        )}
        {ad.link && (
          <div className="small" style={{ marginTop: 6 }}>
            <a href={ad.link} target="_blank" rel="noopener noreferrer">
              Ver destino del anuncio ↗
            </a>
          </div>
        )}

        {m.noResults && (
          <div className="alert-note" style={{ marginTop: 12 }}>
            ⚠ Gastó {formatMoney(m.spend, currency)} sin ninguna compra en el período
          </div>
        )}

        <h3 className="drawer-title">Métricas del período</h3>
        <div className="drawer-totals mono">
          {rows.map(([label, value]) => (
            <div key={label} className="drawer-row">
              <span>{label}</span>
              <span>{value}</span>
            </div>
          ))}
        </div>

        <h3 className="drawer-title">Embudo</h3>
        <Funnel metrics={m} compact />
      </aside>
    </div>
  );
}
