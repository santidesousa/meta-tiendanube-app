"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDateRange } from "./DateRangePicker";
import PageHeader, { oldest } from "./PageHeader";
import ComboChart from "./ComboChart";
import Kpi from "./Kpi";
import Thumb from "./Thumb";
import { fetchJson } from "./api";
import { ConnectionHint } from "./RoleContext";
import {
  delta,
  formatCompactMoney,
  formatMoney,
  formatNumber,
  formatPercent,
} from "./format";
import { computeSummary, dailySeries, daysBetween, previousRange, topProducts } from "@/lib/tiendanubeMetrics";
import { emptyMetrics, withRatios } from "@/lib/metaMetrics";
import { addDays } from "@/lib/dateRange";
import { computeAlerts } from "@/lib/alerts";
import { OBJECTIVE_ORDER, formatResult, rankByObjective } from "@/lib/metaObjectives";

const MARGIN_KEY = "tr_margin";

const notConnected = (msg) => /^No conectado/.test(msg || "");

function readStoredMargin() {
  try {
    const v = parseFloat(localStorage.getItem(MARGIN_KEY));
    return isFinite(v) && v > 0 && v < 1 ? v : null;
  } catch {
    return null;
  }
}

/**
 * Resumen ejecutivo: cruza Tiendanube (ventas reales) con Meta (inversion)
 * para responder "¿la publicidad se paga?" y "¿que tengo que mirar hoy?".
 */
export default function Home({ defaultMargin, marginConfigured }) {
  const [range, setRange] = useDateRange();
  const [margin, setMargin] = useState(defaultMargin);
  const [tn, setTn] = useState(null); // { orders, generatedAt } | { error }
  const [prevTn, setPrevTn] = useState(null);
  const [meta, setMeta] = useState(null); // overview | { error }
  const [abandoned, setAbandoned] = useState(null);
  const [stock, setStock] = useState(null);
  const latestRequest = useRef(0);

  // El margen simulado por cada persona se recuerda en su navegador.
  useEffect(() => {
    const stored = readStoredMargin();
    if (stored) setMargin(stored);
  }, []);

  function changeMargin(v) {
    setMargin(v);
    try {
      localStorage.setItem(MARGIN_KEY, String(v));
    } catch {}
  }

  const load = useCallback(async () => {
    if (!range) return;
    const requestId = ++latestRequest.current;
    const current = () => requestId === latestRequest.current;
    setTn(null);
    setPrevTn(null);
    setMeta(null);
    setAbandoned(null);
    const q = (r) => `since=${r.since}&until=${r.until}`;

    // Cada fuente es independiente: si una falla, el resto se muestra igual.
    await Promise.all([
      fetchJson(`/api/tiendanube/orders?${q(range)}`)
        .then((d) => current() && setTn(d))
        .catch((e) => current() && setTn({ error: e.message })),
      fetchJson(`/api/tiendanube/orders?${q(previousRange(range))}&summary=1`)
        .then((d) => current() && setPrevTn(d.summary))
        .catch(() => {}),
      fetchJson(`/api/meta/overview?${q(range)}`)
        .then((d) => current() && setMeta(d))
        .catch((e) => current() && setMeta({ error: e.message })),
      fetchJson(`/api/tiendanube/abandoned?${q(range)}`)
        .then((d) => current() && setAbandoned(d))
        .catch(() => {}),
      fetchJson(`/api/tiendanube/stock`)
        .then((d) => current() && setStock(d.products))
        .catch(() => {}),
    ]);
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const loading = range && (!tn || !meta);

  return (
    <div>
      <PageHeader
        title="Resumen"
        subtitle="Tout Revient · ventas de Tiendanube e inversión en Meta Ads"
        range={range}
        onRangeChange={setRange}
        generatedAt={oldest(tn?.generatedAt, meta?.generatedAt)}
        onRefresh={load}
      />
      {loading && <HomeSkeleton />}
      {!loading && range && (
        <HomeContent
          range={range}
          tn={tn}
          prevTn={prevTn}
          meta={meta}
          abandoned={abandoned}
          stock={stock}
          margin={margin}
          defaultMargin={defaultMargin}
          marginConfigured={marginConfigured}
          onMarginChange={changeMargin}
        />
      )}
    </div>
  );
}

function HomeContent({ range, tn, prevTn, meta, abandoned, stock, margin, defaultMargin, marginConfigured, onMarginChange }) {
  const hasTn = Boolean(tn?.orders);
  const hasMeta = Boolean(meta && !meta.error);
  const orders = tn?.orders || [];
  const currency = orders[0]?.currency || meta?.account?.currency || "ARS";
  const days = daysBetween(range.since, range.until);
  const money = (v) => formatMoney(v, currency);

  const store = useMemo(() => (hasTn ? computeSummary(orders, range) : null), [hasTn, orders, range]);
  const products = useMemo(() => (hasTn ? topProducts(orders) : []), [hasTn, orders]);
  const t = useMemo(() => (hasMeta ? withRatios(meta.totals) : null), [hasMeta, meta]);
  const pm = useMemo(() => (hasMeta && meta.previous ? withRatios(meta.previous) : null), [hasMeta, meta]);
  const ads = useMemo(
    () => (hasMeta ? rankByObjective(meta.ads.map((a) => ({ ...a, m: withRatios(a.metrics) }))) : []),
    [hasMeta, meta]
  );

  // Serie diaria combinada: facturacion (Tiendanube) + inversion (Meta).
  const series = useMemo(() => {
    const revenueByDay = hasTn ? Object.fromEntries(dailySeries(orders, range.since, range.until).map((d) => [d.day, d])) : {};
    const spendByDay = hasMeta ? Object.fromEntries(meta.daily.map((d) => [d.day, d])) : {};
    const out = [];
    for (let day = range.since; day <= range.until; day = addDays(day, 1)) {
      const m = spendByDay[day] || emptyMetrics();
      out.push({ day, revenue: revenueByDay[day]?.revenue || 0, orders: revenueByDay[day]?.orders || 0, spend: m.spend, purchases: m.purchases });
    }
    return out;
  }, [hasTn, hasMeta, orders, meta, range]);

  const alerts = useMemo(
    () =>
      computeAlerts({ store, prevStore: prevTn, meta: t, prevMeta: pm, ads, products, stock, abandoned, days, margin, money }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, prevTn, t, pm, ads, products, stock, abandoned, days, margin, currency]
  );

  const spend = t?.spend || 0;
  const prevSpend = pm?.spend || 0;
  const revenue = store?.revenue || 0;
  const roas = store && spend ? revenue / spend : null;
  const prevRoas = prevTn && prevSpend ? prevTn.revenue / prevSpend : null;
  const profit = store && t ? revenue * margin - spend : null;
  const prevProfit = prevTn && pm ? prevTn.revenue * margin - prevSpend : null;
  const breakeven = 1 / margin;
  const cac = store?.newCustomers && spend ? spend / store.newCustomers : null;
  const prevCac = prevTn?.newCustomers && prevSpend ? prevSpend / prevTn.newCustomers : null;
  const attributed = store && t?.hasPurchaseValue && revenue ? t.purchaseValue / revenue : null;

  // La creatividad ganadora de cada objetivo (medida por su propio criterio).
  const topAds = OBJECTIVE_ORDER.map((type) => ads.find((a) => a.obj.type === type && a.obj.rank === 1)).filter(Boolean);

  return (
    <div>
      {(tn?.error || meta?.error) && (
        <div className="card kpi-warning small">
          {tn?.error && <div>Tiendanube: {notConnected(tn.error) ? "datos no disponibles." : tn.error}</div>}
          {meta?.error && <div>Meta: {notConnected(meta.error) ? "datos no disponibles." : meta.error}</div>}
          <div>Contactá al administrador.</div>
          <ConnectionHint className="link-btn" />
        </div>
      )}

      <div className="kpi-hero-row kpi-hero-4">
        <Kpi
          hero
          label="Facturación (Tiendanube)"
          value={store ? formatCompactMoney(revenue, currency) : "—"}
          title={store ? money(revenue) : undefined}
          change={prevTn ? delta(revenue, prevTn.revenue) : null}
          sub={store ? `${formatNumber(store.paidCount)} pedidos · ticket ${formatCompactMoney(store.avgTicket, currency)}` : null}
        />
        <Kpi
          hero
          label="Inversión en Meta"
          value={t ? formatCompactMoney(spend, currency) : "—"}
          title={t ? money(spend) : undefined}
          change={pm ? delta(spend, prevSpend) : null}
          sub={store && t && revenue ? `${formatPercent(spend / revenue, 1)} de la facturación` : null}
        />
        <Kpi
          hero
          label="ROAS real"
          value={roas !== null ? `${roas.toFixed(2)}x` : "—"}
          change={roas !== null && prevRoas ? delta(roas, prevRoas) : null}
          tone={roas !== null ? (roas < breakeven ? "danger" : "success") : undefined}
          sub={`Equilibrio: ${breakeven.toFixed(2)}x con margen ${Math.round(margin * 100)}%`}
        />
        <Kpi
          hero
          label="Ganancia después de publicidad"
          value={profit !== null ? formatCompactMoney(profit, currency) : "—"}
          title={profit !== null ? money(profit) : undefined}
          change={profit !== null && prevProfit ? delta(profit, prevProfit) * Math.sign(prevProfit) : null}
          tone={profit !== null && profit < 0 ? "danger" : undefined}
          sub="Facturación × margen − inversión"
        />
      </div>

      <div className="kpi-grid kpi-secondary">
        <Kpi
          label="Clientes nuevos"
          value={store?.newCustomers !== null && store?.newCustomers !== undefined ? formatNumber(store.newCustomers) : "—"}
          change={prevTn && store?.newCustomers !== null ? delta(store.newCustomers, prevTn.newCustomers) : null}
          sub={store?.returningCustomers !== null && store ? `${formatNumber(store.returningCustomers)} recurrentes` : null}
        />
        <Kpi
          label="Costo por cliente nuevo"
          value={cac !== null ? money(cac) : "—"}
          change={cac !== null && prevCac ? delta(cac, prevCac) : null}
          inverse
          sub="Inversión ÷ clientes nuevos"
        />
        <Kpi
          label="Ventas atribuidas a Meta"
          value={attributed !== null ? formatPercent(Math.min(attributed, 1)) : "—"}
          sub={attributed !== null && attributed > 1 ? "Meta se atribuye más de lo facturado (ventana de atribución)" : "Del total facturado"}
        />
        <Kpi
          label="Compras (Meta)"
          value={t ? formatNumber(t.purchases) : "—"}
          change={pm ? delta(t.purchases, pm.purchases) : null}
          sub={t?.cpa ? `CPA ${money(t.cpa)}` : null}
        />
      </div>

      <MarginControl
        margin={margin}
        defaultMargin={defaultMargin}
        marginConfigured={marginConfigured}
        onChange={onMarginChange}
      />

      <div className="two-col">
        <ComboChart
          title="Facturación vs. inversión"
          subtitle="Por día. Cuanto más separadas las barras de la línea, mejor rinde la publicidad."
          series={series}
          bars={{ key: "revenue", label: "Facturación", format: money }}
          line={{ key: "spend", label: "Inversión Meta", format: money }}
          renderTooltip={(d) => (d.spend ? `ROAS del día ${(d.revenue / d.spend).toFixed(2)}x · ${d.orders} pedidos` : `${d.orders} pedidos`)}
        />
        <AlertsCard alerts={alerts} />
      </div>

      <div className="two-col two-col-even" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="card">
          <div className="section-head">
            <h2>Productos más vendidos</h2>
            <Link href={`/dashboard/tiendanube?range=${range.key}${range.key === "custom" ? `&since=${range.since}&until=${range.until}` : ""}`} className="link-btn no-print">
              Ver todos →
            </Link>
          </div>
          {products.length === 0 && <div className="empty-state">Sin ventas en el período.</div>}
          {[...products]
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5)
            .map((p) => (
              <div key={p.key} className="mini-row">
                <Thumb src={p.image} alt={p.name} size={36} />
                <span className="ellipsis" style={{ flex: 1 }}>{p.name}</span>
                <span className="mono small">
                  {p.units} u. · <b>{formatCompactMoney(p.revenue, currency)}</b>
                </span>
              </div>
            ))}
        </div>
        <div className="card">
          <div className="section-head">
            <h2>Mejor creatividad por objetivo</h2>
            <Link href={`/dashboard/meta?range=${range.key}${range.key === "custom" ? `&since=${range.since}&until=${range.until}` : ""}`} className="link-btn no-print">
              Ver todos →
            </Link>
          </div>
          {topAds.length === 0 && <div className="empty-state">Sin anuncios con resultados en el período.</div>}
          {topAds.map((a) => (
            <div key={a.id} className="mini-row">
              <Thumb src={a.image} alt={a.name} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ellipsis">{a.name}</div>
                <span className={`objective-chip obj-${a.obj.type}`}>{a.obj.def.label}</span>
              </div>
              <span className="mono small">
                <b className="text-good">{formatResult(a.obj, formatNumber)}</b>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const ALERT_ICON = { danger: "!", warning: "!", info: "i", good: "✓" };

function AlertsCard({ alerts }) {
  return (
    <div className="card">
      <div className="section-head">
        <div>
          <h2>Qué mirar</h2>
          <div className="section-sub">Detectado automáticamente en el período</div>
        </div>
      </div>
      {alerts.length === 0 && <div className="empty-state">Nada fuera de lo normal. 👌</div>}
      <div className="alert-list">
        {alerts.map((a, i) => {
          const body = (
            <>
              <span className={`alert-icon alert-${a.level}`}>{ALERT_ICON[a.level]}</span>
              <div style={{ minWidth: 0 }}>
                <div className="strong">{a.title}</div>
                <div className="small muted">{a.detail}</div>
              </div>
            </>
          );
          return a.href ? (
            <Link key={i} href={a.href} className="alert-item alert-link">
              {body}
            </Link>
          ) : (
            <div key={i} className="alert-item">
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MarginControl({ margin, defaultMargin, marginConfigured, onChange }) {
  const pctValue = Math.round(margin * 100);
  return (
    <div className="card margin-card no-print">
      <div>
        <div className="kpi-label">Margen bruto usado para la rentabilidad</div>
        <div className="small muted">
          Lo que queda de cada venta después del costo de la mercadería.{" "}
          {marginConfigured
            ? `La agencia configuró ${Math.round(defaultMargin * 100)}%.`
            : "Valor de ejemplo: la agencia puede configurar el real (GROSS_MARGIN)."}{" "}
          Movelo para simular escenarios.
        </div>
      </div>
      <div className="margin-input">
        <input
          type="range"
          min={10}
          max={90}
          step={1}
          value={pctValue}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          aria-label="Margen bruto"
        />
        <span className="mono strong">{pctValue}%</span>
        {Math.abs(margin - defaultMargin) > 0.001 && (
          <button className="link-btn" style={{ padding: 0 }} onClick={() => onChange(defaultMargin)}>
            Restablecer
          </button>
        )}
      </div>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div>
      <div className="kpi-hero-row kpi-hero-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="kpi-card kpi-hero skeleton" style={{ height: 118 }} />
        ))}
      </div>
      <div className="kpi-grid kpi-secondary">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="kpi-card skeleton" style={{ height: 84 }} />
        ))}
      </div>
      <div className="two-col">
        <div className="card skeleton" style={{ height: 300 }} />
        <div className="card skeleton" style={{ height: 300 }} />
      </div>
    </div>
  );
}
