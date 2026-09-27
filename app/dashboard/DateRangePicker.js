"use client";

// YYYY-MM-DD en hora local (toISOString usa UTC, y en Argentina despues de
// las 21hs devolveria el dia siguiente).
function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function presetRange(key) {
  const end = new Date();
  const start = new Date();
  if (key === "today") {
    // start = end = hoy
  } else if (key === "7d") {
    start.setDate(end.getDate() - 6);
  } else if (key === "30d") {
    start.setDate(end.getDate() - 29);
  } else if (key === "month") {
    start.setDate(1);
  }
  return { since: isoDate(start), until: isoDate(end) };
}

const PRESETS = [
  { key: "today", label: "Hoy" },
  { key: "7d", label: "Últimos 7 días" },
  { key: "30d", label: "Últimos 30 días" },
  { key: "month", label: "Este mes" },
];

/**
 * Selector de rango: atajos rapidos + fechas "desde"/"hasta" manuales.
 * `value` es { key, since, until }; key === "custom" cuando se eligio a mano.
 */
export default function DateRangePicker({ value, onChange }) {
  const today = isoDate(new Date());

  function setCustom(field, date) {
    if (!date) return;
    let { since, until } = { ...value, [field]: date };
    // Si el usuario invierte las fechas, las acomodamos en vez de romper.
    if (since > until) [since, until] = [until, since];
    onChange({ key: "custom", since, until });
  }

  return (
    <div className="filter-row date-range">
      {PRESETS.map((p) => (
        <div
          key={p.key}
          className={"filter-pill" + (value.key === p.key ? " active" : "")}
          onClick={() => onChange({ key: p.key, ...presetRange(p.key) })}
        >
          {p.label}
        </div>
      ))}
      <div className={"date-inputs" + (value.key === "custom" ? " active" : "")}>
        <label>
          Desde
          <input
            type="date"
            value={value.since}
            max={today}
            onChange={(e) => setCustom("since", e.target.value)}
          />
        </label>
        <label>
          Hasta
          <input
            type="date"
            value={value.until}
            max={today}
            onChange={(e) => setCustom("until", e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}
