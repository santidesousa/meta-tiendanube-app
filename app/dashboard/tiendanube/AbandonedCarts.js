"use client";

import { useState } from "react";
import Thumb from "../Thumb";
import { CsvButton, downloadCsv } from "../csv";
import { formatDateTime, formatMoney } from "../format";

/**
 * Carritos abandonados del periodo: plata que quedo sin cerrar, con el link
 * de recuperacion de Tiendanube para mandarle a cada cliente.
 */
export default function AbandonedCarts({ data, currency }) {
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState(null);

  if (data.unavailable) {
    return (
      <div className="card">
        <h2>Carritos abandonados</h2>
        <p className="section-sub">
          No se pudieron leer. Puede que la app de Tiendanube no tenga permiso para “checkouts”: reconectarla desde
          Conexiones suele resolverlo.
        </p>
      </div>
    );
  }

  const visible = showAll ? data.items : data.items.slice(0, 8);

  function copy(item) {
    navigator.clipboard?.writeText(item.recoveryUrl);
    setCopied(item.id);
    setTimeout(() => setCopied(null), 1500);
  }

  function exportCsv() {
    downloadCsv("carritos-abandonados", [
      { label: "Fecha", value: (i) => formatDateTime(i.created_at) },
      { label: "Cliente", value: (i) => i.name },
      { label: "Email", value: (i) => i.email },
      { label: "Teléfono", value: (i) => i.phone },
      { label: "Productos", value: (i) => i.products.map((p) => `${p.quantity}x ${p.name}`).join(", ") },
      { label: "Total", value: (i) => i.total },
      { label: "Link de recuperación", value: (i) => i.recoveryUrl },
    ], data.items);
  }

  return (
    <div className="card">
      <div className="section-head">
        <div>
          <h2>Carritos abandonados</h2>
          <div className="section-sub">
            {data.count} carritos · {formatMoney(data.total, currency)} sin cerrar. Mandales el link de
            recuperación (o armá un recordatorio por email/WhatsApp) para recuperar parte de esas ventas.
          </div>
        </div>
        {data.count > 0 && <CsvButton onClick={exportCsv} />}
      </div>

      {data.count === 0 && <div className="empty-state">No hubo carritos abandonados en este período.</div>}

      <div className="table-scroll">
        <table className="data-table">
          <tbody>
            {visible.map((item) => (
              <tr key={item.id}>
                <td style={{ width: 120 }}>
                  <div className="small muted">{formatDateTime(item.created_at)}</div>
                </td>
                <td>
                  <div>{item.name || "Sin nombre"}</div>
                  <div className="small muted">{item.email}</div>
                </td>
                <td className="hide-mobile">
                  <div className="thumb-stack">
                    {item.products.slice(0, 3).map((p, i) => (
                      <Thumb key={i} src={p.image} alt={p.name} size={30} />
                    ))}
                    <span className="small muted ellipsis" style={{ maxWidth: 220 }}>
                      {item.products.map((p) => p.name).join(", ")}
                    </span>
                  </div>
                </td>
                <td className="mono" style={{ textAlign: "right" }}>
                  {formatMoney(item.total, item.currency || currency)}
                </td>
                <td style={{ textAlign: "right" }} className="no-print">
                  {item.recoveryUrl && (
                    <button className="btn-ghost btn-sm" onClick={() => copy(item)}>
                      {copied === item.id ? "¡Copiado!" : "Copiar link"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.items.length > 8 && (
        <button className="link-btn no-print" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Ver menos" : `Ver los ${data.items.length} carritos`}
        </button>
      )}
    </div>
  );
}
