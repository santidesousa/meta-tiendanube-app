"use client";

import { useEffect, useState } from "react";

const cardStyle = {
  background: "#fff",
  border: "1px solid #e2e2e2",
  borderRadius: 10,
  padding: "1rem",
  marginBottom: "0.75rem",
  cursor: "pointer",
};

function formatMoney(value) {
  const n = parseFloat(value || 0);
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function MetaPage() {
  const [accounts, setAccounts] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [campaigns, setCampaigns] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [ads, setAds] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/meta/ad-accounts")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setAccounts(data.data || []);
      })
      .catch((err) => setError(err.message));
  }, []);

  function openAccount(account) {
    setSelectedAccount(account);
    setCampaigns(null);
    setSelectedCampaign(null);
    setAds(null);
    fetch(`/api/meta/campaigns?accountId=${account.id}`)
      .then((res) => res.json())
      .then((data) => setCampaigns(data.data || []));
  }

  function openCampaign(campaign) {
    setSelectedCampaign(campaign);
    setAds(null);
    fetch(`/api/meta/ads?campaignId=${campaign.id}`)
      .then((res) => res.json())
      .then((data) => setAds(data.data || []));
  }

  if (error) {
    return (
      <div>
        <h1>Meta Ads</h1>
        <p style={{ color: "#c0392b" }}>
          {error === "No conectado con Meta todavia"
            ? "Todavía no conectaste tu cuenta de Meta."
            : `Error: ${error}`}
        </p>
        <a href="/api/auth/meta" style={{ color: "#1877F2" }}>
          Conectar cuenta de Meta →
        </a>
      </div>
    );
  }

  return (
    <div>
      <h1>Meta Ads</h1>

      {/* Breadcrumb */}
      <div style={{ marginBottom: "1rem", fontSize: 14, color: "#666" }}>
        <span
          style={{ cursor: "pointer", color: "#1877F2" }}
          onClick={() => {
            setSelectedAccount(null);
            setSelectedCampaign(null);
          }}
        >
          Cuentas
        </span>
        {selectedAccount && (
          <>
            {" / "}
            <span
              style={{ cursor: "pointer", color: "#1877F2" }}
              onClick={() => setSelectedCampaign(null)}
            >
              {selectedAccount.name}
            </span>
          </>
        )}
        {selectedCampaign && <>{" / "}{selectedCampaign.name}</>}
      </div>

      {/* Paso 1: cuentas */}
      {!selectedAccount && (
        <div>
          {!accounts && <p style={{ color: "#666" }}>Cargando cuentas...</p>}
          {accounts &&
            accounts.map((acc) => (
              <div key={acc.id} style={cardStyle} onClick={() => openAccount(acc)}>
                <strong>{acc.name}</strong>
                <div style={{ fontSize: 13, color: "#888" }}>
                  {acc.currency} · estado {acc.account_status}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Paso 2: campañas */}
      {selectedAccount && !selectedCampaign && (
        <div>
          {!campaigns && <p style={{ color: "#666" }}>Cargando campañas...</p>}
          {campaigns &&
            campaigns.map((c) => (
              <div key={c.id} style={cardStyle} onClick={() => openCampaign(c)}>
                <strong>{c.name}</strong>
                <div style={{ fontSize: 13, color: "#888" }}>
                  {c.status} · {c.objective}
                  {c.daily_budget && ` · presupuesto diario ${formatMoney(c.daily_budget / 100)}`}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Paso 3: anuncios con creatividad */}
      {selectedCampaign && (
        <div>
          {!ads && <p style={{ color: "#666" }}>Cargando anuncios...</p>}
          {ads &&
            ads.map((ad) => {
              const insight = ad.insights?.data?.[0];
              const img = ad.creative?.thumbnail_url || ad.creative?.image_url;
              return (
                <div
                  key={ad.id}
                  style={{
                    ...cardStyle,
                    cursor: "default",
                    display: "flex",
                    gap: "1rem",
                  }}
                >
                  {img && (
                    <img
                      src={img}
                      alt={ad.creative?.title || ad.name}
                      style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 6 }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <strong>{ad.name}</strong>
                    <div style={{ fontSize: 13, color: "#888" }}>{ad.status}</div>
                    {insight ? (
                      <div style={{ fontSize: 13, marginTop: 4 }}>
                        Gasto: {formatMoney(insight.spend)} · Impresiones:{" "}
                        {insight.impressions} · Clicks: {insight.clicks} · CTR:{" "}
                        {parseFloat(insight.ctr || 0).toFixed(2)}%
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: "#aaa", marginTop: 4 }}>
                        Sin datos de métricas en el período.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
