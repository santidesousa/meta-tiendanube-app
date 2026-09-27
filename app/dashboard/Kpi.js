import { formatPercent } from "./format";

/**
 * Tarjeta de KPI con variacion vs periodo anterior.
 * - hero: tarjeta grande (los 3-4 numeros principales de cada pagina)
 * - inverse: la metrica es mejor cuando baja (CPA, CPC, CPM)
 * - title: valor completo para el tooltip cuando `value` esta abreviado
 */
export default function Kpi({ label, value, title, change, sub, tone, inverse, hero }) {
  const hasChange = change !== null && change !== undefined && isFinite(change);
  const good = hasChange && (inverse ? change <= 0 : change >= 0);
  return (
    <div className={"kpi-card" + (hero ? " kpi-hero" : "") + (tone ? ` kpi-${tone}` : "")}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" title={title}>
        {value}
      </div>
      {hasChange && (
        <div className={"kpi-delta " + (good ? "up" : "down")}>
          {change >= 0 ? "▲" : "▼"} {formatPercent(Math.abs(change))}
          <span className="kpi-delta-label"> vs. período anterior</span>
        </div>
      )}
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}
