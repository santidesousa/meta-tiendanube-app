"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDateRange } from "../DateRangePicker";
import PageHeader from "../PageHeader";
import BarChart from "../BarChart";
import Kpi from "../Kpi";
import Thumb from "../Thumb";
import { fetchJson } from "../api";
import { ConnectionHint } from "../RoleContext";
import {
  delta,
  formatCompactMoney,
  formatCompactNumber,
  formatDayLabel,
  formatMoney,
  formatNumber,
  formatPercent,
} from "../format";
import { FATIGUE_FREQUENCY, emptyMetrics, withRatios } from "@/lib/metaMetrics";
import { addDays } from "@/lib/dateRange";
import Funnel from "./Funnel";
import Breakdowns from "./Breakdowns";
import Campaigns from "./Campaigns";
import Ads from "./Ads";

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
            {error === NOT_CONNECTED ? "Meta todavía no está conectado." : `No pudimos traer los datos de Meta: ${error}`}
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

  const t = useMemo(() => withRatios(data.totals), [data]);
  const p = useMemo(() => (data.previous ? withRatios(data.previous) : null), [data]);
  const campaigns = useMemo(
    () => data.campaigns.map((c) => ({ ...c, m: withRatios(c.metrics || emptyMetrics()) })),
    [data]
  );
  const ads = useMemo(() => data.ads.map((a) => ({ ...a, m: withRatios(a.metrics) })), [data]);

  // Serie diaria completa (Meta omite los dias sin actividad).
  const series = useMemo(() => {
    const byDay = Object.fromEntries(data.daily.map((d) => [d.day, d]));
    const out = [];
    for (let day = range.since; day <= range.until; day = addDays(day, 1)) {
      const m = withRatios(byDay[day] || emptyMetrics());
      out.push({ day, ...m, roas: m.roas || 0, cpa: m.cpa || 0 });
    }
    return out;
  }, [data, range]);

  const alertAds = ads.filter((a) => a.m.noResults).sort((a, b) => b.m.spend - a.m.spend);
  const fatiguedAds = ads.filter((a) => a.m.fatigue && !a.m.noResults).sort((a, b) => b.m.frequency - a.m.frequency);
  const alertSpend = alertAds.reduce((s, a) => s + a.m.spend, 0);
  const selectedCampaign = campaigns.find((c) => c.id === campaignId) || null;

  const d = (key) => (p ? delta(t[key], p[key]) : null);
  const blendedRoas = store && t.spend ? store.revenue / t.spend : null;

  return (
    <div>
      <div className="kpi-hero-row kpi-hero-4">
        <Kpi
          hero
          label="Inversión"
          value={formatCompactMoney(t.spend, currency)}
          title={formatMoney(t.spend, currency)}
          change={d("spend")}
          sub={`${formatMoney(t.spend / series.length, currency)} por día`}
        />
        <Kpi hero label="Compras" value={formatNumber(t.purchases)} change={d("purchases")} sub="Atribuidas por Meta" />
        <Kpi
          hero
          label="ROAS"
          value={t.roas !== null ? `${t.roas.toFixed(2)}x` : "—"}
          change={d("roas")}
          tone={t.roas !== null && t.roas < 1 ? "danger" : undefined}
          sub={t.hasPurchaseValue ? `${formatCompactMoney(t.purchaseValue, currency)} en compras` : null}
        />
        <Kpi
          hero
          label="Costo por compra"
          value={t.cpa !== null ? formatMoney(t.cpa, currency) : "—"}
          change={d("cpa")}
          inverse
        />
      </div>

      <div className="kpi-grid kpi-secondary">
        <Kpi
          label="CTR (enlace)"
          value={formatPercent(t.ctr, 2)}
          change={d("ctr")}
          sub={`${formatCompactNumber(t.linkClicks)} clicks`}
        />
        <Kpi label="CPC (enlace)" value={t.cpc !== null ? formatMoney(t.cpc, currency) : "—"} change={d("cpc")} inverse />
        <Kpi
          label="CPM"
          value={t.cpm !== null ? formatMoney(t.cpm, currency) : "—"}
          change={d("cpm")}
          inverse
          sub={`${formatCompactNumber(t.impressions)} impresiones`}
        />
        <Kpi
          label="Alcance"
          value={t.reach ? formatCompactNumber(t.reach) : "—"}
          title={t.reach ? formatNumber(t.reach) : undefined}
          sub={t.frequency ? `Frecuencia ${t.frequency.toFixed(2)}` : null}
          tone={t.frequency >= FATIGUE_FREQUENCY ? "warning" : undefined}
        />
        <Kpi
          label="Conversión (click → compra)"
          value={t.convRate !== null ? formatPercent(t.convRate, 2) : "—"}
          change={d("convRate")}
        />
      </div>
      {p && (
        <div className="section-sub" style={{ marginTop: -18, marginBottom: 20 }}>
          Variaciones vs. el período anterior ({formatDayLabel(data.previousRange.since)} –{" "}
          {formatDayLabel(data.previousRange.until)}). En CPA, CPC y CPM bajar es bueno.
        </div>
      )}

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

      <BarChart
        title="Evolución diaria"
        series={series}
        metrics={[
          { key: "spend", label: "Inversión", format: (v) => formatMoney(v, currency) },
          { key: "purchases", label: "Compras", format: (v) => v.toLocaleString("es-AR") },
          { key: "purchaseValue", label: "Valor", format: (v) => formatMoney(v, currency) },
          { key: "roas", label: "ROAS", format: (v) => `${v.toFixed(2)}x` },
          { key: "cpa", label: "CPA", format: (v) => formatMoney(v, currency) },
        ]}
        summary={(m) => {
          if (m.key === "roas" || m.key === "cpa") {
            const withData = series.filter((s) => s[m.key] > 0);
            if (!withData.length) return "Sin compras en el período";
            const best = withData.reduce((a, b) =>
              m.key === "roas" ? (b.roas > a.roas ? b : a) : b.cpa < a.cpa ? b : a
            );
            return `Mejor día: ${formatDayLabel(best.day)} (${m.format(best[m.key])})`;
          }
          const total = series.reduce((s, x) => s + x[m.key], 0);
          return `Total ${m.format(total)} · promedio diario ${m.format(total / series.length)}`;
        }}
        renderTooltip={(x) => (
          <>
            <div>{formatMoney(x.spend, currency)} invertidos</div>
            <div className="tt-muted">
              {x.purchases} compras{x.cpa ? ` · CPA ${formatMoney(x.cpa, currency)}` : ""}
              {x.roas ? ` · ROAS ${x.roas.toFixed(2)}x` : ""}
            </div>
          </>
        )}
      />

      <div className="two-col two-col-even">
        <Funnel metrics={t} />
        <Breakdowns range={range} currency={currency} />
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
      <div className="kpi-hero-row kpi-hero-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="kpi-card kpi-hero skeleton" style={{ height: 118 }} />
        ))}
      </div>
      <div className="kpi-grid kpi-secondary">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="kpi-card skeleton" style={{ height: 84 }} />
        ))}
      </div>
      <div className="card skeleton" style={{ height: 260 }} />
    </div>
  );
}
