// Exportar tablas a CSV (abre bien en Excel/Google Sheets en español).

function escape(value) {
  if (value === null || value === undefined) return "";
  const s = typeof value === "number" ? String(value).replace(".", ",") : String(value);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * @param {string} filename - sin extension
 * @param {Array<{label: string, value: (row) => any}>} columns
 * @param {Array<object>} rows
 */
export function downloadCsv(filename, columns, rows) {
  // Separador ";" y coma decimal: es lo que espera Excel con configuracion
  // regional de Argentina. El BOM hace que respete los acentos.
  const lines = [
    columns.map((c) => escape(c.label)).join(";"),
    ...rows.map((r) => columns.map((c) => escape(c.value(r))).join(";")),
  ];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function CsvButton({ onClick, label = "Exportar CSV" }) {
  return (
    <button className="btn-ghost btn-sm no-print" onClick={onClick}>
      {label}
    </button>
  );
}
