"use client";

import { useEffect, useRef, useState } from "react";
import DateRangePicker, { presetRange } from "../DateRangePicker";

// Cuenta publicitaria fija: el cliente solo ve esta cuenta, no el listado
// completo de cuentas a las que Claude/la agencia tiene acceso.
const ACCOUNT_ID = "act_1487373418081023";
const ACCOUNT_NAME = "Tout Revient";

function formatMoney(value) {
  const n = parseFloat(value || 0);
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

// Meta reporta las compras bajo distintos action_type segun el evento.
// Probamos en orden de preferencia y nos quedamos con el primero que
// tenga datos, para no duplicar el conteo.
const PURCHASE_ACTION_TYPES = [
  "omni_purchase",
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
];

// Devuelve { count, value } de compras usando un unico action_type: el
// primero de la lista que aparezca en "actions". El valor ($) se toma del
// mismo action_type en "action_values" para que conteo y valor coincidan.
function getPurchaseStats(insight) {
  const actions = insight?.actions || [];
  for (const type of PURCHASE_ACTION_TYPES) {
    const match = actions.find((a) => a.action_type === type);
    if (!match) continue;
    const valueMatch = (insight.action_values || []).find(
      (a) => a.action_type === type
    );
    return {
      count: parseInt(match.value, 10) || 0,
      value: valueMatch ? parseFloat(valueMatch.value) || 0 : null,
    };
  }
  return { count: 0, value: null };
}

function Metric({ label, value, tone }) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <span className={"metric-value" + (tone ? ` ${tone}` : "")}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }) {
  const cls =
    status === "ACTIVE"
      ? "badge badge-active"
      : status === "PAUSED"
      ? "badge badge-paused"
      : "badge badge-other";
  const label =
    status === "ACTIVE" ? "Activa" : status === "PAUSED" ? "Pausada" : status;
  return <span className={cls}>{label}</span>;
}

function FilterPills({ value, onChange, counts }) {
  const options = [
    { key: "ALL", label: `Todas (${counts.all})` },
    { key: "ACTIVE", label: `Activas (${counts.active})` },
    { key: "PAUSED", label: `Pausadas (${counts.paused})` },
  ];
  return (
    <div className="filter-row">
      {options.map((opt) => (
        <div
          key={opt.key}
          className={"filter-pill" + (value === opt.key ? " active" : "")}
          onClick={() => onChange(opt.key)}
        >
          {opt.label}
        </div>
      ))}
    </div>
  );
}

function countByStatus(items) {
  return {
    all: items.length,
    active: items.filter((i) => i.status === "ACTIVE").length,
    paused: items.filter((i) => i.status === "PAUSED").length,
  };
}

function filterByStatus(items, filter) {
  if (filter === "ALL") return items;
  return items.filter((i) => i.status === filter);
}

// Activas primero, y dentro de cada grupo, orden alfabetico.
function sortCampaigns(items) {
  return [...items].sort((a, b) => {
    if (a.status === b.status) return a.name.localeCompare(b.name);
    return a.status === "ACTIVE" ? -1 : 1;
  });
}

export default function MetaPage() {
  const [range, setRange] = useState({ key: "30d", ...presetRange("30d") });
  const [campaigns, setCampaigns] = useState(null);
  const [campaignFilter, setCampaignFilter] = useState("ALL");
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [ads, setAds] = useState(null);
  const [adFilter, setAdFilter] = useState("ALL");
  const [adsError, setAdsError] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/meta/campaigns?accountId=${ACCOUNT_ID}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setCampaigns(data.data || []);
      })
      .catch((err) => setError(err.message));
  }, []);

  const latestAdsRequest = useRef(0);

  function fetchAds(campaign, dateRange) {
    const requestId = ++latestAdsRequest.current;
    setAds(null);
    setAdsError(null);
    fetch(
      `/api/meta/ads?campaignId=${campaign.id}&since=${dateRange.since}&until=${dateRange.until}`
    )
      .then((res) => res.json())
      .then((data) => {
        // Si el usuario cambio de rango/campana mientras cargaba, descartamos.
        if (requestId !== latestAdsRequest.current) return;
        if (data.error) {
          setAdsError(data.error);
          return;
        }
        // Ordena por gasto (mayor a menor) para ver primero lo mas relevante.
        const sorted = (data.data || []).sort((a, b) => {
          const spendA = parseFloat(a.insights?.data?.[0]?.spend || 0);
          const spendB = parseFloat(b.insights?.data?.[0]?.spend || 0);
          return spendB - spendA;
        });
        setAds(sorted);
      })
      .catch((err) => {
        if (requestId === latestAdsRequest.current) setAdsError(err.message);
      });
  }

  function openCampaign(campaign) {
    setSelectedCampaign(campaign);
    setAdFilter("ALL");
    fetchAds(campaign, range);
  }

  // Si cambia el rango de fechas mientras hay una campana abierta, re-consulta.
  useEffect(() => {
    if (selectedCampaign) fetchAds(selectedCampaign, range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  if (error) {
    return (
      <div>
        <h1>Meta Ads</h1>
        <p style={{ color: "var(--danger)" }}>
          {error === "No conectado con Meta todavia"
            ? "Todavía no conectaste tu cuenta de Meta."
            : `Error: ${error}`}
        </p>
        <a href="/api/auth/meta" className="btn btn-meta">
          Conectar cuenta de Meta
        </a>
      </div>
    );
  }

  const sortedCampaigns = campaigns ? sortCampaigns(campaigns) : [];
  const filteredCampaigns = filterByStatus(sortedCampaigns, campaignFilter);
  const filteredAds = ads ? filterByStatus(ads, adFilter) : [];

  return (
    <div>
      <h1>Meta Ads</h1>
      <p style={{ color: "var(--muted)", marginTop: 0, fontSize: "0.85rem" }}>
        Cuenta: {ACCOUNT_NAME}
      </p>

      <div className="breadcrumb">
        <span
          className="breadcrumb-link"
          onClick={() => setSelectedCampaign(null)}
        >
          Campañas
        </span>
        {selectedCampaign && <>{" / "}{selectedCampaign.name}</>}
      </div>

      <DateRangePicker value={range} onChange={setRange} />
      {selectedCampaign && (
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: -8 }}>
          Las métricas de los anuncios corresponden a este período. La lista
          de campañas no cambia con el filtro.
        </p>
      )}

      {/* Paso 1: campañas */}
      {!selectedCampaign && (
        <div>
          {!campaigns && <p style={{ color: "var(--muted)" }}>Cargando campañas...</p>}
          {campaigns && (
            <>
              <FilterPills
                value={campaignFilter}
                onChange={setCampaignFilter}
                counts={countByStatus(campaigns)}
              />
              {filteredCampaigns.map((c) => (
                <div
                  key={c.id}
                  className="card card-clickable"
                  onClick={() => openCampaign(c)}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <strong>{c.name}</strong>
                    <StatusBadge status={c.status} />
                  </div>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                    {c.objective}
                    {c.daily_budget &&
                      ` · presupuesto diario ${formatMoney(c.daily_budget / 100)}`}
                  </div>
                </div>
              ))}
              {filteredCampaigns.length === 0 && (
                <div className="empty-state">No hay campañas con este filtro.</div>
              )}
            </>
          )}
        </div>
      )}

      {/* Paso 2: anuncios con creatividad, ordenados por gasto */}
      {selectedCampaign && (
        <div>
          {adsError && (
            <p style={{ color: "var(--danger)" }}>Error: {adsError}</p>
          )}
          {!ads && !adsError && (
            <p style={{ color: "var(--muted)" }}>Cargando anuncios...</p>
          )}
          {ads && (
            <>
              <FilterPills
                value={adFilter}
                onChange={setAdFilter}
                counts={countByStatus(ads)}
              />
              {filteredAds.map((ad) => {
                const insight = ad.insights?.data?.[0];
                const img = ad.creative?.thumbnail_url || ad.creative?.image_url;
                const spend = parseFloat(insight?.spend || 0);
                const clicks = parseInt(insight?.clicks || 0, 10);
                const { count: purchases, value: purchaseValue } =
                  getPurchaseStats(insight);
                const cpa = purchases > 0 ? spend / purchases : null;
                const roas =
                  purchaseValue !== null && spend > 0 ? purchaseValue / spend : null;
                // Alerta: gastando plata pero sin ninguna compra registrada.
                const noResults = spend > 0 && purchases === 0;
                return (
                  <div
                    key={ad.id}
                    className={"card" + (noResults ? " ad-card-alert" : "")}
                    style={{ display: "flex", gap: "1rem" }}
                  >
                    {img && (
                      <img
                        src={img}
                        alt={ad.creative?.title || ad.name}
                        style={{
                          width: 72,
                          height: 72,
                          objectFit: "cover",
                          borderRadius: 8,
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <strong>{ad.name}</strong>
                        <StatusBadge status={ad.status} />
                      </div>
                      {insight ? (
                        <>
                          <div className="metric-grid">
                            <Metric label="Gasto" value={formatMoney(spend)} />
                            <Metric
                              label="Impresiones"
                              value={parseInt(insight.impressions || 0, 10).toLocaleString("es-AR")}
                            />
                            <Metric label="Clicks" value={clicks.toLocaleString("es-AR")} />
                            <Metric
                              label="CTR"
                              value={`${parseFloat(insight.ctr || 0).toFixed(2)}%`}
                            />
                            <Metric
                              label="Ventas"
                              value={purchases}
                              tone={noResults ? "bad" : purchases > 0 ? "good" : undefined}
                            />
                            <Metric
                              label="CPA"
                              value={cpa !== null ? formatMoney(cpa) : "—"}
                              tone={noResults ? "bad" : undefined}
                            />
                            {purchaseValue !== null && (
                              <>
                                <Metric
                                  label="Valor compras"
                                  value={formatMoney(purchaseValue)}
                                />
                                <Metric
                                  label="ROAS"
                                  value={roas !== null ? `${roas.toFixed(2)}x` : "—"}
                                  tone={roas !== null && roas >= 1 ? "good" : "bad"}
                                />
                              </>
                            )}
                          </div>
                          {noResults && (
                            <div className="alert-note">
                              ⚠ Gastó {formatMoney(spend)} sin ninguna compra en este período
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                          Sin datos de métricas en el período.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {filteredAds.length === 0 && (
                <div className="empty-state">No hay anuncios con este filtro.</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
