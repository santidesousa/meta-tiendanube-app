"use client";

import { useEffect, useState } from "react";
import { withRatios } from "@/lib/metaMetrics";
import { formatMoney, formatPercent } from "../format";

const TABS = [
  { key: "age_gender", label: "Edad y género" },
  { key: "platform", label: "Plataforma" },
  { key: "placement", label: "Ubicación" },
  { key: "region", label: "Región" },
  { key: "device", label: "Dispositivo" },
  { key: "hourly", label: "Hora del día" },
];

/**
 * Desgloses de la cuenta. Cada pestana se pide recien cuando se abre (y se
 * guarda en memoria para el rango actual), para no cargar la pagina de
 * llamadas a la API que quizas nadie mira.
 */
export default function Breakdowns({ range, currency }) {
  const [active, setActive] = useState("age_gender");
  const [cache, setCache] = useState({});
  const cacheKey = `${active}|${range.since}|${range.until}`;
  const entry = cache[cacheKey];

  useEffect(() => {
    if (cache[cacheKey]) return;
    let cancelled = false;
    fetch(`/api/meta/breakdown?type=${active}&since=${range.since}&until=${range.until}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setCache((c) => ({ ...c, [cacheKey]: data.error ? { error: data.error } : { rows: data.rows } }));
      })
      .catch((err) => !cancelled && setCache((c) => ({ ...c, [cacheKey]: { error: err.message } })));
    return () => {
      cancelled = true;
    };
  }, [cacheKey, cache, active, range]);

  let rows = entry?.rows ? entry.rows.map(withRatios) : [];
  if (active === "hourly") rows.sort((a, b) => a.hour - b.hour);
  else rows.sort((a, b) => b.spend - a.spend);
  rows = rows.filter((r) => r.spend > 0 || r.purchases > 0);

  const totalSpend = rows.reduce((s, r) => s + r.spend, 0);
  const maxSpend = Math.max(1, ...rows.map((r) => r.spend));
  const withSales = rows.filter((r) => r.purchases > 0 && r.cpa !== null);
  const best = withSales.length ? withSales.reduce((a, b) => (b.cpa < a.cpa ? b : a)) : null;
  const mostSales = rows.length ? rows.reduce((a, b) => (b.purchases > a.purchases ? b : a)) : null;

  return (
    <div className="card">
      <div className="section-head">
        <div>
          <h2>¿A quién y dónde le vende?</h2>
          <div className="section-sub">
            {best
              ? `Mejor CPA: ${best.label} (${formatMoney(best.cpa, currency)})` +
                (mostSales && mostSales.purchases > 0 && mostSales.label !== best.label
                  ? ` · más compras: ${mostSales.label} (${mostSales.purchases})`
                  : "")
              : "Inversión y resultados por segmento"}
          </div>
        </div>
      </div>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={t.key === active ? "active" : ""} onClick={() => setActive(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {!entry && <div className="skeleton" style={{ height: 180, borderRadius: 8 }} />}
      {entry?.error && <p style={{ color: "var(--danger)" }}>No se pudo cargar: {entry.error}</p>}
      {entry?.rows && rows.length === 0 && <div className="empty-state">Sin datos para este período.</div>}

      {rows.length > 0 && (
        <div className="table-scroll" style={{ maxHeight: 420, overflowY: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{TABS.find((t) => t.key === active).label}</th>
                <th style={{ width: "28%" }}>Inversión</th>
                <th style={{ textAlign: "right" }}>Compras</th>
                <th style={{ textAlign: "right" }}>CPA</th>
                <th style={{ textAlign: "right" }}>ROAS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className={r.noResults && r.spend > totalSpend * 0.05 ? "row-alert" : ""}>
                  <td>{active === "hourly" ? `${r.label} hs` : r.label}</td>
                  <td>
                    <div className="mono small">
                      {formatMoney(r.spend, currency)}{" "}
                      <span className="muted">{totalSpend ? formatPercent(r.spend / totalSpend) : ""}</span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${(r.spend / maxSpend) * 100}%` }} />
                    </div>
                  </td>
                  <td className="mono" style={{ textAlign: "right" }}>
                    {r.purchases}
                  </td>
                  <td className="mono" style={{ textAlign: "right" }}>
                    {r.cpa !== null ? formatMoney(r.cpa, currency) : "—"}
                  </td>
                  <td className={"mono " + roasClass(r.roas)} style={{ textAlign: "right" }}>
                    {r.roas !== null ? `${r.roas.toFixed(2)}x` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {active === "hourly" && rows.length > 0 && (
        <div className="section-sub" style={{ marginTop: 8 }}>
          Hora en la zona horaria de la cuenta publicitaria.
        </div>
      )}
    </div>
  );
}

export function roasClass(roas) {
  if (roas === null || roas === undefined) return "";
  return roas >= 1 ? "text-good" : "text-bad";
}
