"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDateRange } from "../DateRangePicker";
import PageHeader from "../PageHeader";
import Thumb from "../Thumb";
import { fetchJson } from "../api";
import { ConnectionHint } from "../RoleContext";
import {
  formatCompactNumber,
  formatDayLabel,
  formatMoney,
  formatPercent,
} from "../format";
import { FATIGUE_FREQUENCY, emptyMetrics, withRatios } from "@/lib/metaMetrics";
import { addDays } from "@/lib/dateRange";
import Funnel from "./Funnel";
import Breakdowns from "./Breakdowns";
import Campaigns from "./Campaigns";
import Ads from "./Ads";
import MetricCards from "../MetricCards";
import Evolution from "../Evolution";
import { CARD_KEYS, EVOLUTION_DEFAULT, EVOLUTION_KEYS, metricDefs } from "./metricDefs";

const NOT_CONNECTED = "No conectado con Meta todavia";

// La cuenta de Tout Revient la fija el servidor (/api/meta/overview).
export default function MetaPage() {
  const [range, setRange] = useDateRange();
  const [data, setData] = useState(null);
  const [store, setStore] = useState(null);
  const [error, setError] = useState(null);
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    if (!range) return;
    const requestId = ++latestRequest.current;
    const current = () => requestId === latestRequest.current;
    setData(null);
    setStore(null);
    setError(null);
    const query = `since=${range.since}&until=${range.until}`;

    // Ventas reales de Tiendanube para el ROAS real. Opcional: si no esta
    // conectada (o es otra tienda) simplemente no se muestra.
    fetchJson(`/api/tiendanube/orders?${query}&summary=1`)
      .then((d) => current() && setStore(d.summary))
      .catch(() => {});

    try {
      const d = await fetchJson(`/api/meta/overview?${query}`);
      if (current()) setData(d);
    } catch (err) {
      if (current()) setError(err.message);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Meta Ads"
        subtitle={`Cuenta: ${data?.account.name || "Tout Revient"}${data?.account.currency ? ` · ${data.account.currency}` : ""}`}
        range={range}
        onRangeChange={setRange}
        generatedAt={data?.generatedAt}
        onRefresh={load}
      />
      {error && (
        <div className="card">
          <p style={{ color: "var(--danger)", marginTop: 0 }}>
            {error === NOT_CONNECTED ? "Datos no disponibles, contactá al administrador." : `No pudimos traer los datos de Meta: ${error}`}
          </p>
          <ConnectionHint className="btn btn-meta" />
        </div>
      )}
      {!error && range && !data && <LoadingSkeleton />}
      {data && <Dashboard data={data} store={store} range={range} />}
    </div>
  );
}

function Dashboard({ data, store, range }) {
  const [campaignId, setCampaignId] = useState(null);
  const [openAd, setOpenAd] = useState(null);
  const currency = data.account.currency || "ARS";
  const defs = useMemo(() => metricDefs(currency), [currency]);

  const t = useMemo(() => withRatios(data.totals), [data]);
  const p = useMemo(() => (data.previous ? withRatios(data.previous) : null), [data]);
  const campaigns = useMemo(
    () => data.campaigns.map((c) => ({ ...c, m: withRatios(c.metrics || emptyMetrics()) })),
    [data]
  );
  const ads = useMemo(() => data.ads.map((a) => ({ ...a, m: withRatios(a.metrics) })), [data]);

  // Serie diaria completa (Meta omite los dias sin actividad). Los ratios
  // quedan en null cuando no hay base (ej. ROAS sin gasto) para no dibujar
  // ceros que no existen.
  const series = useMemo(() => {
    const byDay = Object.fromEntries(data.daily.map((d) => [d.day, d]));
    const out = [];
    for (let day = range.since; day <= range.until; day = addDays(day, 1)) {
      out.push({ day, ...withRatios(byDay[day] || emptyMetrics()) });
    }
    return out;
  }, [data, range]);
  const weekly = useMemo(() => (data.weekly || []).map((w) => ({ ...w, ...withRatios(w) })), [data]);

  const alertAds = ads.filter((a) => a.m.noResults).sort((a, b) => b.m.spend - a.m.spend);
  const fatiguedAds = ads.filter((a) => a.m.fatigue && !a.m.noResults).sort((a, b) => b.m.frequency - a.m.frequency);
  const alertSpend = alertAds.reduce((s, a) => s + a.m.spend, 0);
  const selectedCampaign = campaigns.find((c) => c.id === campaignId) || null;

  const blendedRoas = store && t.spend ? store.revenue / t.spend : null;

  return (
    <div>
      <MetricCards defs={defs} keys={CARD_KEYS} current={t} previous={p} series={series} />
      <div className="stat-strip">
        <span>
          Alcance <b>{t.reach ? formatCompactNumber(t.reach) : "—"}</b>
        </span>
        <span className={t.frequency >= FATIGUE_FREQUENCY ? "text-bad" : ""}>
          Frecuencia <b>{t.frequency ? t.frequency.toFixed(2) : "—"}</b>
        </span>
        <span>
          Impresiones <b>{formatCompactNumber(t.impressions)}</b>
        </span>
        <span>
          Clicks en el enlace <b>{formatCompactNumber(t.linkClicks)}</b>
        </span>
        <span>
          CPM <b>{t.cpm !== null ? formatMoney(t.cpm, currency) : "—"}</b>
        </span>
        <span>
          Conversión click → compra <b>{t.convRate !== null ? formatPercent(t.convRate, 2) : "—"}</b>
        </span>
      </div>
      {p && (
        <div className="section-sub" style={{ marginBottom: 16 }}>
          Variaciones vs. {formatDayLabel(data.previousRange.since)} – {formatDayLabel(data.previousRange.until)}{" "}
          (mismos días inmediatamente anteriores). Verde = mejora, rojo = empeora. CTR y CPC: sobre clicks en el
          enlace.
        </div>
      )}

      <Evolution
        defs={defs}
        toggleKeys={EVOLUTION_KEYS}
        defaultOn={EVOLUTION_DEFAULT}
        weekly={weekly}
        daily={series}
      />

      {store && (
        <div className="card insight-banner">
          <div>
            <div className="kpi-label">ROAS real (ventas totales de Tiendanube ÷ inversión en Meta)</div>
            <div className="kpi-value">{blendedRoas !== null ? `${blendedRoas.toFixed(2)}x` : "—"}</div>
          </div>
          <div className="section-sub" style={{ flex: 1 }}>
            Tiendanube facturó <b>{formatMoney(store.revenue, currency)}</b> en {store.paidCount} pedidos pagados en
            el período. Meta se atribuye {t.purchases} compras
            {store.paidCount && t.purchases <= store.paidCount
              ? ` (${formatPercent(t.purchases / store.paidCount)} de los pedidos)`
              : store.paidCount
              ? " — más que los pedidos reales: Meta cuenta por ventana de atribución y puede incluir compras de otras fechas o duplicadas"
              : ""}
            . El ROAS real incluye todas las ventas de la tienda (también las orgánicas), así que sirve para ver si la
            inversión total se paga, no para comparar anuncios.
          </div>
        </div>
      )}

      {alertAds.length > 0 && (
        <div className="card ad-card-alert">
          <div className="section-head" style={{ marginBottom: 8 }}>
            <div>
              <h2>
                ⚠ {alertAds.length} {alertAds.length === 1 ? "anuncio gastó" : "anuncios gastaron"} sin vender
              </h2>
              <div className="section-sub">
                {formatMoney(alertSpend, currency)} invertidos ({t.spend ? formatPercent(alertSpend / t.spend) : "—"} del
                total) sin ninguna compra en el período. Click para ver el detalle.
              </div>
            </div>
          </div>
          <div className="alert-ads">
            {alertAds.slice(0, 6).map((a) => (
              <div key={a.id} className="alert-ad" onClick={() => setOpenAd(a)}>
                <Thumb src={a.image} alt={a.name} size={40} />
                <div style={{ minWidth: 0 }}>
                  <div className="small strong ellipsis">{a.name}</div>
                  <div className="small mono text-bad">{formatMoney(a.m.spend, currency)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {fatiguedAds.length > 0 && (
        <div className="card kpi-warning">
          <div className="section-head" style={{ marginBottom: 8 }}>
            <div>
              <h2>
                {fatiguedAds.length} {fatiguedAds.length === 1 ? "anuncio muestra" : "anuncios muestran"} fatiga
              </h2>
              <div className="section-sub">
                La misma gente los vio {FATIGUE_FREQUENCY} veces o más en el período: suelen perder rendimiento. Conviene
                renovar la creatividad o ampliar el público.
              </div>
            </div>
          </div>
          <div className="alert-ads">
            {fatiguedAds.slice(0, 6).map((a) => (
              <div key={a.id} className="alert-ad" onClick={() => setOpenAd(a)}>
                <Thumb src={a.image} alt={a.name} size={40} />
                <div style={{ minWidth: 0 }}>
                  <div className="small strong ellipsis">{a.name}</div>
                  <div className="small mono">Frecuencia {a.m.frequency.toFixed(1)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="two-col two-col-even">
        <Funnel metrics={t} />
        <Breakdowns range={range} currency={currency} />
      </div>

      <div className="detail-heading">
        <h2>Detalle: campañas y anuncios</h2>
        <div className="section-sub">Todo lo de abajo corresponde al período elegido.</div>
      </div>

      <Campaigns
        campaigns={campaigns}
        totalSpend={t.spend}
        currency={currency}
        selectedId={campaignId}
        onSelect={(id) => {
          setCampaignId(id);
          if (id) document.getElementById("anuncios")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />

      <Ads
        ads={ads}
        currency={currency}
        campaignFilter={selectedCampaign}
        onClearCampaign={() => setCampaignId(null)}
        openAd={openAd}
        onOpenAd={setOpenAd}
      />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div>
      <div className="metric-cards">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="metric-card skeleton" style={{ height: 150 }} />
        ))}
      </div>
      <div className="card skeleton" style={{ height: 380 }} />
    </div>
  );
}
