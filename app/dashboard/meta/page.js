"use client";

import { useEffect, useState } from "react";

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
  const [campaigns, setCampaigns] = useState(null);
  const [campaignFilter, setCampaignFilter] = useState("ALL");
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [ads, setAds] = useState(null);
  const [adFilter, setAdFilter] = useState("ALL");
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

  function openCampaign(campaign) {
    setSelectedCampaign(campaign);
    setAdFilter("ALL");
    setAds(null);
    fetch(`/api/meta/ads?campaignId=${campaign.id}`)
      .then((res) => res.json())
      .then((data) => {
        // Ordena por gasto (mayor a menor) para ver primero lo mas relevante.
        const sorted = (data.data || []).sort((a, b) => {
          const spendA = parseFloat(a.insights?.data?.[0]?.spend || 0);
          const spendB = parseFloat(b.insights?.data?.[0]?.spend || 0);
          return spendB - spendA;
        });
        setAds(sorted);
      });
  }

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
          {!ads && <p style={{ color: "var(--muted)" }}>Cargando anuncios...</p>}
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
                // Alerta: gastando plata pero sin ningun click.
                const noResults = insight && spend > 0 && clicks === 0;
                return (
                  <div
                    key={ad.id}
                    className="card"
                    style={{
                      display: "flex",
                      gap: "1rem",
                      borderColor: noResults ? "var(--danger)" : undefined,
                    }}
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
                        <div
                          className="mono"
                          style={{
                            fontSize: 13,
                            marginTop: 4,
                            color: noResults ? "var(--danger)" : "var(--success)",
                            fontWeight: 600,
                          }}
                        >
                          {formatMoney(insight.spend)} gastado · {insight.impressions}{" "}
                          impresiones · {clicks} clicks · CTR{" "}
                          {parseFloat(insight.ctr || 0).toFixed(2)}%
                          {noResults && " · sin clicks todavía"}
                        </div>
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
