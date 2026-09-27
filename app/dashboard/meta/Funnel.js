import { formatPercent } from "../format";

/**
 * Embudo: impresiones -> clicks -> visitas -> carrito -> pago -> compra.
 * Muestra la conversion entre cada paso para detectar donde se cae la gente.
 * Los pasos sin datos (pixel sin ese evento) se omiten.
 */
export default function Funnel({ metrics, compact = false }) {
  const steps = [
    { key: "impressions", label: "Impresiones" },
    { key: "linkClicks", label: "Clicks en el enlace" },
    { key: "landingViews", label: "Visitas a la web" },
    { key: "viewContent", label: "Vieron un producto" },
    { key: "addToCart", label: "Agregaron al carrito" },
    { key: "checkouts", label: "Iniciaron el pago" },
    { key: "purchases", label: "Compraron" },
  ].filter((s, i, all) => s.key === "impressions" || s.key === "purchases" || metrics[s.key] > 0);

  const top = Math.max(1, metrics.impressions);
  // Escala logaritmica: de impresiones a compras hay ordenes de magnitud y
  // con escala lineal los ultimos pasos serian invisibles.
  const width = (v) => (v > 0 ? Math.max(4, (Math.log10(v + 1) / Math.log10(top + 1)) * 100) : 0);

  // El paso con peor conversion (sin contar impresiones -> click).
  let worst = null;
  steps.forEach((s, i) => {
    if (i < 2) return;
    const prev = metrics[steps[i - 1].key];
    const rate = prev ? metrics[s.key] / prev : null;
    if (rate !== null && (worst === null || rate < worst.rate)) worst = { key: s.key, rate };
  });

  return (
    <div className={compact ? "" : "card"}>
      {!compact && (
        <div className="section-head">
          <div>
            <h2>Embudo de conversión</h2>
            <div className="section-sub">De cada paso al siguiente. En rojo, donde más gente se pierde.</div>
          </div>
        </div>
      )}
      <div className="funnel">
        {steps.map((s, i) => {
          const value = metrics[s.key] || 0;
          const prev = i > 0 ? metrics[steps[i - 1].key] : null;
          const rate = prev ? value / prev : null;
          const isWorst = worst?.key === s.key;
          return (
            <div key={s.key} className="funnel-step">
              <div className="funnel-top">
                <span>{s.label}</span>
                <span className="mono strong">{Math.round(value).toLocaleString("es-AR")}</span>
              </div>
              <div className="bar-track funnel-track">
                <div className={"bar-fill" + (isWorst ? " bad" : "")} style={{ width: `${width(value)}%` }} />
              </div>
              {rate !== null && (
                <div className={"funnel-rate" + (isWorst ? " bad" : "")}>
                  {formatPercent(rate, rate < 0.1 ? 2 : 1)} del paso anterior
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
