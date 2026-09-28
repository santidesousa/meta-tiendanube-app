"use client";

import { useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDayLabel } from "../format";
import { metricDefs } from "./metricDefs";

const TOGGLE_KEYS = ["spend", "purchaseValue", "roas", "purchases", "cpa", "ctr", "cpc", "cpm", "aov"];
const DEFAULT_ON = ["spend", "purchaseValue", "roas"];

/**
 * Evolucion de la cuenta: barras de Gasto e Ingresos (eje $ a la izquierda)
 * y lineas para el resto. El ROAS usa un eje propio visible a la derecha;
 * las demas lineas tienen cada una su escala (oculta) para que se vea su
 * tendencia sin aplastarse, y el tooltip muestra los valores reales.
 *
 * - weekly / daily: series con ratios (withRatios), cada item con `day`
 */
export default function Evolution({ weekly, daily, currency }) {
  const defs = metricDefs(currency);
  // Con pocos dias, una barra por semana no dice nada: arrancamos por dia.
  const [grouping, setGrouping] = useState(daily.length > 21 ? "week" : "day");
  const [selected, setSelected] = useState(DEFAULT_ON);

  const data = (grouping === "week" ? weekly : daily).map((d) => ({
    ...d,
    label: formatDayLabel(d.day, true),
  }));

  function toggle(key) {
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));
  }

  const bars = selected.filter((k) => defs[k].kind === "bar");
  const lines = selected.filter((k) => defs[k].kind !== "bar");

  return (
    <div className="card evolution-card">
      <div className="section-head">
        <div>
          <h2 className="eyebrow">Evolución</h2>
        </div>
        <div className="section-tools">
          <span className="section-sub">Agrupado por</span>
          <div className="segmented">
            <button className={grouping === "week" ? "active" : ""} onClick={() => setGrouping("week")}>
              Semana
            </button>
            <button className={grouping === "day" ? "active" : ""} onClick={() => setGrouping("day")}>
              Día
            </button>
          </div>
        </div>
      </div>

      <div className="metric-toggles">
        {TOGGLE_KEYS.map((key) => {
          const on = selected.includes(key);
          return (
            <button
              key={key}
              className={"metric-toggle" + (on ? " on" : "")}
              style={on ? { background: defs[key].color, borderColor: defs[key].color } : undefined}
              onClick={() => toggle(key)}
            >
              <i style={{ background: on ? "#fff" : defs[key].color }} />
              {defs[key].short || defs[key].label}
            </button>
          );
        })}
      </div>

      {selected.length === 0 && <div className="empty-state">Elegí al menos una métrica.</div>}

      {selected.length > 0 && (
        <div className="evolution-chart">
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }} barGap={4}>
              <CartesianGrid stroke="#efefec" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#6b7280", fontFamily: "IBM Plex Mono, monospace" }}
                axisLine={{ stroke: "#e3e3df" }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={12}
              />
              <YAxis
                yAxisId="money"
                hide={bars.length === 0}
                tick={{ fontSize: 11, fill: "#6b7280", fontFamily: "IBM Plex Mono, monospace" }}
                tickFormatter={defs.spend.axis}
                axisLine={false}
                tickLine={false}
                width={84}
              />
              <YAxis
                yAxisId="roas"
                orientation="right"
                hide={!lines.includes("roas")}
                domain={[0, "auto"]}
                tick={{ fontSize: 11, fill: "#6b7280", fontFamily: "IBM Plex Mono, monospace" }}
                tickFormatter={defs.roas.axis}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              {lines
                .filter((k) => k !== "roas")
                .map((k) => (
                  <YAxis key={k} yAxisId={k} hide domain={[0, "auto"]} />
                ))}
              <Tooltip
                cursor={{ fill: "rgba(20,23,26,0.04)" }}
                content={<EvolutionTooltip defs={defs} grouping={grouping} keys={selected} />}
              />
              {bars.map((k) => (
                <Bar
                  key={k}
                  yAxisId="money"
                  dataKey={k}
                  fill={defs[k].color}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                  isAnimationActive={false}
                />
              ))}
              {lines.map((k) => (
                <Line
                  key={k}
                  yAxisId={k === "roas" ? "roas" : k}
                  type="monotone"
                  dataKey={k}
                  stroke={defs[k].color}
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
          <div className="evolution-legend">
            {selected.map((k) => (
              <span key={k}>
                <i style={{ background: defs[k].color }} />
                {defs[k].label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EvolutionTooltip({ active, payload, defs, grouping, keys }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const title =
    grouping === "week" && d.until
      ? `Semana ${formatDayLabel(d.day, true)} – ${formatDayLabel(d.until, true)}`
      : formatDayLabel(d.day);
  return (
    <div className="chart-tooltip" style={{ position: "static" }}>
      <div className="tt-title">{title}</div>
      {keys.map((k) => (
        <div key={k} className="tt-row">
          <i style={{ background: defs[k].color }} />
          <span>{defs[k].label}</span>
          <b>{d[k] === null || d[k] === undefined ? "—" : defs[k].format(d[k])}</b>
        </div>
      ))}
    </div>
  );
}
