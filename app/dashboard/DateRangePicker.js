"use client";

import { useCallback, useEffect, useState } from "react";

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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Estado del rango de fechas sincronizado con la URL (?range=30d o
 * ?since=...&until=...), para poder compartir un link con un periodo.
 * Devuelve null en el primer render (hasta leer la URL), asi no se pide
 * dos veces la misma data.
 */
export function useDateRange(defaultKey = "30d") {
  const [range, setRangeState] = useState(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const key = p.get("range");
    let since = p.get("since");
    let until = p.get("until");
    if (key && PRESETS.some((x) => x.key === key)) {
      setRangeState({ key, ...presetRange(key) });
    } else if (DATE_RE.test(since || "") && DATE_RE.test(until || "")) {
      if (since > until) [since, until] = [until, since];
      setRangeState({ key: "custom", since, until });
    } else {
      setRangeState({ key: defaultKey, ...presetRange(defaultKey) });
    }
  }, [defaultKey]);

  const setRange = useCallback((next) => {
    setRangeState(next);
    const p = new URLSearchParams(window.location.search);
    ["range", "since", "until"].forEach((k) => p.delete(k));
    if (next.key === "custom") {
      p.set("since", next.since);
      p.set("until", next.until);
    } else {
      p.set("range", next.key);
    }
    window.history.replaceState(null, "", `${window.location.pathname}?${p}`);
  }, []);

  return [range, setRange];
}

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
