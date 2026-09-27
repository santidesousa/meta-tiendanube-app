"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DateRangePicker, { presetRange } from "../DateRangePicker";
import BarChart from "../BarChart";
import Kpi from "../Kpi";
import Thumb from "../Thumb";
import { delta, formatDayLabel, formatMoney, formatPercent } from "../format";
import { emptyMetrics, withRatios } from "@/lib/metaMetrics";
import { addDays } from "@/lib/dateRange";
import { computeSummary } from "@/lib/tiendanubeMetrics";
import Funnel from "./Funnel";
import Breakdowns from "./Breakdowns";
import Campaigns from "./Campaigns";
import Ads from "./Ads";

// La cuenta de Tout Revient la fija el servidor (/api/meta/overview).
export default function MetaPage() {
  const [range, setRange] = useState({ key: "30d", ...presetRange("30d") });
  const [data, setData] = useState(null);
  const [store, setStore] = useState(null);
  const [error, setError] = useState(null);
  const latestRequest = useRef(0);

  useEffect(() => {
    const requestId = ++latestRequest.current;
    setData(null);
    setStore(null);
    setError(null);
    const query = `since=${range.since}&until=${range.until}`;

    fetch(`/api/meta/overview?${query}`)
      .then((r) => r.json())
      .then((d) => {
        if (requestId !== latestRequest.current) return;
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch((err) => requestId === latestRequest.current && setError(err.message));

    // Ventas reales de Tiendanube para el ROAS real. Opcional: si no esta
    // conectada (o es otra tienda) simplemente no se muestra.
    fetch(`/api/tiendanube/orders?${query}`)
      .then((r) => r.json())
      .then((d) => {
        if (requestId === latestRequest.current && d.orders) setStore(computeSummary(d.orders));
      })
      .catch(() => {});
  }, [range]);

  if (error) {
    return (
      <div>
        <h1>Meta Ads</h1>
        <DateRangePicker value={range} onChange={setRange} />
        <div className="card">
          <p style={{ color: "var(--danger)", marginTop: 0 }}>
            {error === "No conectado con Meta todavia"
              ? "Todavía no conectaste tu cuenta de Meta."
              : `No pudimos traer los datos de Meta: ${error}`}
          </p>
          <a href="/api/auth/meta" className="btn btn-meta">
            {error === "No conectado con Meta todavia" ? "Conectar" : "Reconectar"} cuenta de Meta
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1>Meta Ads</h1>
      <p style={{ color: "var(--muted)", marginTop: 0, fontSize: "0.85rem" }}>
        Cuenta: {data?.account.name || "Tout Revient"}
        {data?.account.currency ? ` · ${data.account.currency}` : ""}
      </p>
      <DateRangePicker value={range} onChange={setRange} />
      {!data && <LoadingSkeleton />}
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
  const alertSpend = alertAds.reduce((s, a) => s + a.m.spend, 0);
  const selectedCampaign = campaigns.find((c) => c.id === campaignId) || null;

  const d = (key) => (p ? delta(t[key], p[key]) : null);
  const blendedRoas = store && t.spend ? store.revenue / t.spend : null;

  return (
    <div>
      <div className="kpi-grid kpi-grid-4">
        <Kpi
          label="Inversión"
          value={formatMoney(t.spend, currency)}
          change={d("spend")}
          sub={t.reach ? `Alcance ${Math.round(t.reach).toLocaleString("es-AR")} · frec. ${t.frequency?.toFixed(2)}` : null}
        />
        <Kpi label="Compras" value={t.purchases} change={d("purchases")} sub="Atribuidas por Meta" />
        <Kpi
          label="Valor de compras"
          value={t.hasPurchaseValue ? formatMoney(t.purchaseValue, currency) : "—"}
          change={d("purchaseValue")}
        />
        <Kpi
          label="ROAS"
          value={t.roas !== null ? `${t.roas.toFixed(2)}x` : "—"}
          change={d("roas")}
          tone={t.roas !== null && t.roas < 1 ? "danger" : undefined}
        />
        <Kpi label="Costo por compra (CPA)" value={t.cpa !== null ? formatMoney(t.cpa, currency) : "—"} change={d("cpa")} inverse />
        <Kpi
          label="CTR (enlace)"
          value={formatPercent(t.ctr, 2)}
          change={d("ctr")}
          sub={`${Math.round(t.linkClicks).toLocaleString("es-AR")} clicks`}
        />
        <Kpi label="CPC (enlace)" value={t.cpc !== null ? formatMoney(t.cpc, currency) : "—"} change={d("cpc")} inverse />
        <Kpi
          label="CPM"
          value={t.cpm !== null ? formatMoney(t.cpm, currency) : "—"}
          change={d("cpm")}
          inverse
          sub={`${Math.round(t.impressions).toLocaleString("es-AR")} impresiones`}
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
      <div className="kpi-grid kpi-grid-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="kpi-card skeleton" style={{ height: 92 }} />
        ))}
      </div>
      <div className="card skeleton" style={{ height: 260 }} />
      <p style={{ color: "var(--muted)" }}>Cargando datos de Meta…</p>
    </div>
  );
}
