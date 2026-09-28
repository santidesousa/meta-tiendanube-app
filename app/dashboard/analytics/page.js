"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDateRange } from "../DateRangePicker";
import PageHeader from "../PageHeader";
import MetricCards from "../MetricCards";
import Evolution from "../Evolution";
import Funnel from "../meta/Funnel";
import { fetchJson } from "../api";
import { ConnectionHint } from "../RoleContext";
import { formatDayLabel, formatMoney, formatNumber, formatPercent } from "../format";
import { emptyGaMetrics, withGaRatios } from "@/lib/gaMetrics";
import { addDays } from "@/lib/dateRange";
import { ChannelsTable, GaBreakdowns } from "./GaTables";
import { CARD_KEYS, EVOLUTION_DEFAULT, EVOLUTION_KEYS, metricDefs } from "./metricDefs";

const NOT_CONNECTED = "No conectado con Google Analytics todavia";

// Pasos del embudo de compra con los eventos de e-commerce de GA4.
const FUNNEL_STEPS = [
  { key: "sessions", label: "Sesiones" },
  { key: "addToCarts", label: "Agregaron al carrito" },
  { key: "checkouts", label: "Iniciaron el pago" },
  { key: "purchases", label: "Compraron" },
];

export default function AnalyticsPage() {
  const [range, setRange] = useDateRange();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    if (!range) return;
    const requestId = ++latestRequest.current;
    setData(null);
    setError(null);
    try {
      const d = await fetchJson(`/api/ga/overview?since=${range.since}&until=${range.until}`);
      if (requestId === latestRequest.current) setData(d);
    } catch (err) {
      if (requestId === latestRequest.current) setError(err.message);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const subtitle =
    data?.realtimeUsers !== null && data?.realtimeUsers !== undefined
      ? `Tout Revient · ${formatNumber(data.realtimeUsers)} ${data.realtimeUsers === 1 ? "usuario" : "usuarios"} en el sitio ahora`
      : "Tout Revient · tráfico y comportamiento en la tienda online";

  return (
    <div>
      <PageHeader
        title="Google Analytics"
        subtitle={subtitle}
        range={range}
        onRangeChange={setRange}
        generatedAt={data?.generatedAt}
        onRefresh={load}
      />
      {error && (
        <div className="card">
          <p style={{ color: "var(--danger)", marginTop: 0 }}>
            {error === NOT_CONNECTED ? "Datos no disponibles, contactá al administrador." : `No pudimos traer los datos de Google Analytics: ${error}`}
          </p>
          <ConnectionHint className="btn btn-primary" />
        </div>
      )}
      {!error && range && !data && <LoadingSkeleton />}
      {data && <Dashboard data={data} range={range} />}
    </div>
  );
}

function Dashboard({ data, range }) {
  const currency = data.currency || "ARS";
  const defs = useMemo(() => metricDefs(currency), [currency]);
  const t = useMemo(() => withGaRatios(data.totals || emptyGaMetrics()), [data]);
  const p = useMemo(() => (data.previous ? withGaRatios(data.previous) : null), [data]);

  // Serie diaria completa (GA omite los dias sin datos).
  const daily = useMemo(() => {
    const byDay = Object.fromEntries(data.daily.map((d) => [d.day, d]));
    const out = [];
    for (let day = range.since; day <= range.until; day = addDays(day, 1)) {
      out.push({ day, ...withGaRatios(byDay[day] || emptyGaMetrics()) });
    }
    return out;
  }, [data, range]);
  const weekly = useMemo(() => data.weekly.map((w) => ({ ...w, ...withGaRatios(w) })), [data]);

  return (
    <div>
      <MetricCards defs={defs} keys={CARD_KEYS} current={t} previous={p} series={daily} />
      <div className="stat-strip">
        <span>
          Vistas de página <b>{formatNumber(t.views)}</b>
        </span>
        <span>
          Vistas por sesión <b>{t.viewsPerSession !== null ? t.viewsPerSession.toFixed(1) : "—"}</b>
        </span>
        <span>
          Tasa de rebote <b>{t.bounceRate !== null ? formatPercent(t.bounceRate, 1) : "—"}</b>
        </span>
        <span>
          Usuarios nuevos <b>{t.newUserShare !== null ? formatPercent(t.newUserShare) : "—"}</b>
        </span>
        <span>
          Agregados al carrito <b>{formatNumber(t.addToCarts)}</b>
        </span>
        <span>
          Ticket promedio <b>{t.aov !== null ? formatMoney(t.aov, currency) : "—"}</b>
        </span>
      </div>
      <div className="section-sub" style={{ marginBottom: 16 }}>
        {p
          ? `Variaciones vs. ${formatDayLabel(data.previousRange.since)} – ${formatDayLabel(data.previousRange.until)} (mismos días inmediatamente anteriores). Verde = mejora, rojo = empeora.`
          : "Sin datos del período anterior para comparar."}{" "}
        Tiempo medio = tiempo de interacción por usuario (como en GA4). Conversión = compras ÷ sesiones.
      </div>

      <Evolution
        defs={defs}
        toggleKeys={EVOLUTION_KEYS}
        defaultOn={EVOLUTION_DEFAULT}
        weekly={weekly}
        daily={daily}
      />

      <div className="two-col ga-top-row">
        <Funnel
          metrics={t}
          steps={FUNNEL_STEPS}
          title="Embudo de compra"
          subtitle="Eventos de e-commerce de GA4. En rojo, el paso donde más se pierde."
        />
        <ChannelsTable channels={data.channels} currency={currency} />
      </div>

      <GaBreakdowns range={range} currency={currency} />
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
