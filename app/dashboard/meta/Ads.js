"use client";

import { useEffect, useState } from "react";
import { formatMoney, formatNumber, formatPercent } from "../format";
import { StatusBadge } from "./Campaigns";
import Funnel from "./Funnel";
import Thumb from "../Thumb";
import { CsvButton, downloadCsv } from "../csv";
import { OBJECTIVE_ORDER, OBJECTIVE_TYPES, formatResult } from "@/lib/metaObjectives";

// Cada anuncio llega con `obj` (ver rankByObjective): tipo de objetivo,
// resultado, costo por resultado, noResult y posicion (rank) en su objetivo.

const SORTS = [
  { key: "result", label: "Resultado" },
  { key: "spend", label: "Inversión" },
  { key: "roas", label: "ROAS" },
  { key: "ctr", label: "CTR" },
];

const FILTERS = [
  // Circulando hoy: anuncio, conjunto y campana activos (estado efectivo),
  // tenga o no resultados en el periodo elegido.
  { key: "ACTIVE", label: "Activos ahora", test: (a) => a.status === "ACTIVE" },
  { key: "ALL", label: "Con actividad", test: (a) => a.m.impressions > 0 || a.m.spend > 0 },
  { key: "RESULTS", label: "Con resultados", test: (a) => a.obj.result > 0 },
  { key: "ALERT", label: "Sin resultados", test: (a) => a.obj.noResult },
  { key: "FATIGUE", label: "Con fatiga", test: (a) => a.m.fatigue },
];

const typeOrder = (t) => OBJECTIVE_ORDER.indexOf(t);

function sortRows(rows, sortKey) {
  return [...rows].sort((a, b) => {
    if (sortKey === "result") {
      // Agrupados por objetivo y, dentro de cada uno, el mejor primero.
      return (
        typeOrder(a.obj.type) - typeOrder(b.obj.type) ||
        b.obj.result - a.obj.result ||
        (a.obj.costPerResult ?? Infinity) - (b.obj.costPerResult ?? Infinity)
      );
    }
    const va = a.m[sortKey];
    const vb = b.m[sortKey];
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    return vb - va;
  });
}

function exportAds(rows) {
  downloadCsv("anuncios-meta", [
    { label: "Anuncio", value: (a) => a.name },
    { label: "Campaña", value: (a) => a.campaignName },
    { label: "Conjunto", value: (a) => a.adsetName },
    { label: "Estado", value: (a) => a.status },
    { label: "Objetivo", value: (a) => a.obj.def.label },
    { label: "Resultado (según objetivo)", value: (a) => a.obj.result },
    { label: "Tipo de resultado", value: (a) => a.obj.def.resultLabel },
    { label: "Costo por resultado", value: (a) => a.obj.costPerResult },
    { label: "Posición en su objetivo", value: (a) => (a.obj.rank ? `${a.obj.rank} de ${a.obj.of}` : "") },
    { label: "Inversión", value: (a) => a.m.spend },
    { label: "Impresiones", value: (a) => a.m.impressions },
    { label: "Frecuencia", value: (a) => a.m.frequency },
    { label: "Clicks enlace", value: (a) => a.m.linkClicks },
    { label: "CTR", value: (a) => a.m.ctr },
    { label: "CPC", value: (a) => a.m.cpc },
    { label: "Añadidos al carrito", value: (a) => a.m.addToCart },
    { label: "Compras", value: (a) => a.m.purchases },
    { label: "Valor compras", value: (a) => (a.m.hasPurchaseValue ? a.m.purchaseValue : null) },
    { label: "ROAS", value: (a) => a.m.roas },
  ], rows);
}

/**
 * Podio por objetivo: las 3 creatividades que mejor performaron segun el
 * criterio de su objetivo (carrito -> anadidos, trafico -> clics, DPA ->
 * ventas, conversiones -> compras).
 */
export function ObjectiveLeaders({ ads, currency, onOpenAd }) {
  const groups = OBJECTIVE_ORDER.map((type) => ({
    type,
    def: OBJECTIVE_TYPES[type],
    list: ads
      .filter((a) => a.obj.type === type && a.obj.rank)
      .sort((x, y) => x.obj.rank - y.obj.rank)
      .slice(0, 3),
    total: ads.filter((a) => a.obj.type === type && (a.m.spend > 0 || a.m.impressions > 0)).length,
  })).filter((g) => g.total > 0);

  if (groups.length === 0) return null;

  return (
    <div className="card">
      <div className="section-head">
        <div>
          <h2>Mejores creatividades por objetivo</h2>
          <div className="section-sub">
            Cada anuncio compite con los de su mismo objetivo y se mide por lo que se buscaba: Conversiones y DPA por
            compras, Añadir al carrito por añadidos, Tráfico por clics.
          </div>
        </div>
      </div>
      <div className="objective-groups">
        {groups.map((g) => (
          <div key={g.type} className="objective-group">
            <div className="objective-group-head">
              <span className={`objective-chip obj-${g.type}`}>{g.def.label}</span>
              <span className="small muted">
                por {g.def.resultLabel.toLowerCase()} · {g.total} {g.total === 1 ? "anuncio" : "anuncios"}
              </span>
            </div>
            {g.list.length === 0 && <div className="small muted">Ningún anuncio tuvo resultados en el período.</div>}
            {g.list.map((a) => (
              <div key={a.id} className={"leader-row" + (a.obj.rank === 1 ? " leader-first" : "")} onClick={() => onOpenAd(a)}>
                <span className="leader-rank">{a.obj.rank === 1 ? "🏆" : `#${a.obj.rank}`}</span>
                <Thumb src={a.image} alt={a.name} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="small strong ellipsis" title={a.name}>
                    {a.name}
                  </div>
                  <div className="small muted ellipsis">{a.campaignName}</div>
                </div>
                <div className="leader-stats mono">
                  <div className="strong">{formatResult(a.obj, formatNumber)}</div>
                  <div className="muted">
                    {a.obj.costPerResult !== null ? `${formatMoney(a.obj.costPerResult, currency)} c/u` : "—"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Grilla de creatividades con sus metricas del periodo. `campaignFilter`
 * viene de la tabla de campanas.
 */
export default function Ads({ ads, currency, campaignFilter, onClearCampaign, openAd, onOpenAd }) {
  const [sortKey, setSortKey] = useState("result");
  const [objective, setObjective] = useState("ALL");
  // Arranca mostrando lo que esta circulando hoy (si hay algo activo).
  const [filter, setFilter] = useState(() => (ads.some((a) => a.status === "ACTIVE") ? "ACTIVE" : "ALL"));
  const [limit, setLimit] = useState(12);

  useEffect(() => setLimit(12), [campaignFilter, filter, sortKey, objective]);

  const byCampaign = campaignFilter ? ads.filter((a) => a.campaignId === campaignFilter.id) : ads;
  const statusTest = FILTERS.find((f) => f.key === filter).test;
  const objectiveTypes = OBJECTIVE_ORDER.filter((t) => byCampaign.some((a) => a.obj.type === t));
  const base = objective === "ALL" ? byCampaign : byCampaign.filter((a) => a.obj.type === objective);
  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, base.filter(f.test).length]));
  const rows = sortRows(base.filter(statusTest), sortKey);

  return (
    <div className="card" id="anuncios">
      <div className="section-head">
        <div>
          <h2>Anuncios</h2>
          <div className="section-sub">
            {filter === "ACTIVE"
              ? `${rows.length} anuncios circulando hoy · métricas del período elegido`
              : `${rows.length} anuncios`}{" "}
            · “Resultado” se mide según el objetivo de cada anuncio · click para ver el detalle
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

      {objectiveTypes.length > 1 && (
        <div className="filter-row objective-filter" style={{ flexWrap: "wrap" }}>
          <span className="small muted">Objetivo:</span>
          <div
            className={"filter-pill" + (objective === "ALL" ? " active" : "")}
            onClick={() => setObjective("ALL")}
          >
            Todos
          </div>
          {objectiveTypes.map((t) => (
            <div
              key={t}
              className={"filter-pill" + (objective === t ? " active" : "")}
              onClick={() => setObjective(t)}
            >
              {OBJECTIVE_TYPES[t].label} ({byCampaign.filter((a) => a.obj.type === t && statusTest(a)).length})
            </div>
          ))}
        </div>
      )}

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

function RankBadge({ obj }) {
  if (!obj.rank) return null;
  return obj.rank === 1 ? (
    <span className="rank-badge rank-first">🏆 Mejor de {obj.def.label}</span>
  ) : (
    <span className="rank-badge">
      #{obj.rank} de {obj.of} en {obj.def.label}
    </span>
  );
}

function AdCard({ ad, currency, onClick }) {
  const m = ad.m;
  const { obj } = ad;
  // Sexta metrica: si el resultado ya son compras, mostramos CPC; si no,
  // las compras (para ver si ademas vendio).
  const extra =
    obj.def.resultKey === "purchases"
      ? { label: "CPC", value: m.cpc !== null ? formatMoney(m.cpc, currency) : "—" }
      : { label: "Compras", value: formatNumber(m.purchases) };
  return (
    <div className={"ad-card" + (obj.noResult ? " ad-card-alert" : "") + (obj.rank === 1 ? " ad-card-winner" : "")} onClick={onClick}>
      <div className="ad-image">
        {ad.image ? <img src={ad.image} alt={ad.name} loading="lazy" /> : <div className="ad-noimage">Sin imagen</div>}
        {ad.isVideo && <span className="ad-video-tag">▶ Video</span>}
        {m.fatigue && <span className="ad-fatigue-tag">Fatiga · frec. {m.frequency.toFixed(1)}</span>}
        <span className={`objective-chip objective-on-image obj-${obj.type}`}>{obj.def.label}</span>
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
        <RankBadge obj={obj} />
        <div className="ad-metrics">
          <Metric label="Inversión" value={formatMoney(m.spend, currency)} />
          <Metric
            label={obj.def.resultLabel}
            value={formatNumber(obj.result)}
            tone={obj.noResult ? "bad" : obj.result > 0 ? "good" : ""}
            highlight
          />
          <Metric
            label="Costo/res."
            value={obj.costPerResult !== null ? formatMoney(obj.costPerResult, currency) : "—"}
            tone={obj.noResult ? "bad" : ""}
          />
          <Metric
            label="ROAS"
            value={m.roas !== null ? `${m.roas.toFixed(2)}x` : "—"}
            tone={m.roas === null ? "" : m.roas >= 1 ? "good" : "bad"}
          />
          <Metric label="CTR" value={formatPercent(m.ctr, 2)} />
          <Metric label={extra.label} value={extra.value} />
        </div>
        {obj.noResult && (
          <div className="alert-note">
            ⚠ Gastó {formatMoney(m.spend, currency)} sin {obj.def.resultLabel.toLowerCase()}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, tone, highlight }) {
  return (
    <div className={"metric" + (highlight ? " metric-highlight" : "")}>
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
  const { obj } = ad;
  const rows = [
    ["Objetivo", obj.def.label],
    [`Resultado (${obj.def.resultLabel.toLowerCase()})`, formatNumber(obj.result)],
    [obj.def.costLabel, obj.costPerResult !== null ? formatMoney(obj.costPerResult, currency) : "—"],
    ["Posición en su objetivo", obj.rank ? `#${obj.rank} de ${obj.of}` : "—"],
    ["Inversión", formatMoney(m.spend, currency)],
    ["Impresiones", Math.round(m.impressions).toLocaleString("es-AR")],
    ["Frecuencia", m.frequency !== null && m.frequency !== undefined ? m.frequency.toFixed(2) : "—"],
    ["Clicks en el enlace", Math.round(m.linkClicks).toLocaleString("es-AR")],
    ["CTR (enlace)", formatPercent(m.ctr, 2)],
    ["CPC", m.cpc !== null ? formatMoney(m.cpc, currency) : "—"],
    ["CPM", m.cpm !== null ? formatMoney(m.cpm, currency) : "—"],
    ["Añadidos al carrito", formatNumber(m.addToCart)],
    ["Compras", formatNumber(m.purchases)],
    ["Valor de compras", m.hasPurchaseValue ? formatMoney(m.purchaseValue, currency) : "—"],
    ["ROAS", m.roas !== null ? `${m.roas.toFixed(2)}x` : "—"],
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
        <div style={{ marginBottom: 12, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <StatusBadge status={ad.status} />
          <span className={`objective-chip obj-${obj.type}`}>{obj.def.label}</span>
          <RankBadge obj={obj} />
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

        {obj.noResult && (
          <div className="alert-note" style={{ marginTop: 12 }}>
            ⚠ Gastó {formatMoney(m.spend, currency)} sin {obj.def.resultLabel.toLowerCase()} en el período
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
