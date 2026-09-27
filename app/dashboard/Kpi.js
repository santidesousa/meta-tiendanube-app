import { formatPercent } from "./format";

/**
 * Tarjeta de KPI con variacion vs periodo anterior.
 * `inverse`: la metrica es mejor cuando baja (CPA, CPC, CPM).
 */
export default function Kpi({ label, value, change, sub, tone, inverse }) {
  const hasChange = change !== null && change !== undefined && isFinite(change);
  const good = hasChange && (inverse ? change <= 0 : change >= 0);
  return (
    <div className={"kpi-card" + (tone ? ` kpi-${tone}` : "")}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {hasChange && (
        <div className={"kpi-delta " + (good ? "up" : "down")}>
          {change >= 0 ? "▲" : "▼"} {formatPercent(Math.abs(change))}
        </div>
      )}
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}
