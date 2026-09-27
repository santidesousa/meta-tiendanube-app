"use client";

function isoDate(d) {
  return d.toISOString().slice(0, 10);
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

export default function DateRangePicker({ activeKey, onChange }) {
  return (
    <div className="filter-row">
      {PRESETS.map((p) => (
        <div
          key={p.key}
          className={"filter-pill" + (activeKey === p.key ? " active" : "")}
          onClick={() => onChange({ key: p.key, ...presetRange(p.key) })}
        >
          {p.label}
        </div>
      ))}
    </div>
  );
}
