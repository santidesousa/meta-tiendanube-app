"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "../api";

function StatusBadge({ ok }) {
  return ok ? (
    <span className="badge badge-active">Configurado en Vercel</span>
  ) : (
    <span className="badge badge-danger">Falta configurar</span>
  );
}

function daysUntil(iso) {
  return Math.round((new Date(iso) - Date.now()) / 86400000);
}

// Pagina solo para la agencia: estado de las variables de entorno, acceso a
// los flujos que generan los tokens y link de acceso para el cliente.
export default function ConexionesPage() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [clientLink, setClientLink] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    fetchJson("/api/admin/connections").then(setStatus).catch((e) => setError(e.message));
    fetchJson("/api/admin/client-link").then((d) => setClientLink(d.url)).catch(() => {});
  }, []);

  if (error) return <p style={{ color: "var(--danger)" }}>{error}</p>;

  const meta = status?.meta;
  const tn = status?.tiendanube;
  const metaOk = Boolean(meta?.source && meta.account);
  const tnOk = Boolean(tn?.source && tn.ok);
  const metaDays = meta?.token?.expiresAt ? daysUntil(meta.token.expiresAt) : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Conexiones</h1>
          <p className="page-sub">Solo visible para la agencia.</p>
        </div>
      </div>

      {!status && <div className="card skeleton" style={{ height: 200 }} />}

      {status && (!metaOk || !tnOk) && (
        <div className="card kpi-warning">
          <strong>Tu clienta todavía no ve todos los datos.</strong>
          <div className="small" style={{ marginTop: 4 }}>
            Tocá “Obtener token” en lo que falte, copiá los valores que aparecen a Vercel → Environment Variables y
            hacé Redeploy.
          </div>
        </div>
      )}

      {status && (
        <div className="two-col two-col-even" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="card">
            <div className="section-head">
              <h2>Meta Ads</h2>
              <StatusBadge ok={metaOk} />
            </div>
            <div className="drawer-block">
              <div>
                Cuenta: <b>{meta.account ? meta.account.name : "—"}</b>{" "}
                <span className="muted mono small">{status.expected.adAccountId}</span>
              </div>
              {!meta.source && <div className="muted small">Falta la variable META_ACCESS_TOKEN.</div>}
              {meta.error && <div className="alert-note">El token no puede leer la cuenta: {meta.error}</div>}
              {meta.token && (
                <div className={metaDays !== null && metaDays < 10 ? "alert-note" : "muted small"} style={{ marginTop: 4 }}>
                  {meta.token.neverExpires
                    ? "El token no vence (usuario del sistema)."
                    : metaDays !== null
                    ? `El token vence en ${metaDays} días (${new Date(meta.token.expiresAt).toLocaleDateString("es-AR")}).`
                    : ""}
                </div>
              )}
            </div>
            <a href="/api/auth/meta" className="btn btn-meta" style={{ marginTop: 12 }}>
              {metaOk ? "Renovar token" : "Obtener token"} de Meta
            </a>
          </div>

          <div className="card">
            <div className="section-head">
              <h2>Tiendanube</h2>
              <StatusBadge ok={tnOk} />
            </div>
            <div className="drawer-block">
              <div>
                Tienda: <b>{tn.store ? tn.store.name : "—"}</b>{" "}
                {tn.store && <span className="muted mono small">#{tn.store.id}</span>}
              </div>
              {!tn.source && (
                <div className="muted small">Faltan TIENDANUBE_ACCESS_TOKEN y/o TIENDANUBE_STORE_ID.</div>
              )}
              {tn.store && !tn.ok && <div className="alert-note">No es Tout Revient: el panel la bloquea.</div>}
              {tn.error && <div className="alert-note">{tn.error}</div>}
            </div>
            <a href="/api/auth/tiendanube" className="btn btn-tiendanube" style={{ marginTop: 12 }}>
              {tnOk ? "Volver a obtener token" : "Obtener token"} de Tiendanube
            </a>
            <div className="muted small" style={{ marginTop: 8 }}>
              Antes, entrá a Tiendanube con la cuenta de Tout Revient.
            </div>
          </div>
        </div>
      )}

      {clientLink && (
        <div className="card">
          <div className="section-head" style={{ marginBottom: 8 }}>
            <div>
              <h2>Link para tu clienta</h2>
              <div className="section-sub">
                Entra directo al panel, sin contraseña y en modo solo lectura. Tratalo como una contraseña: quien lo
                tenga puede ver los datos. Para invalidarlo, cambiá DASHBOARD_PASSWORD en Vercel.
              </div>
            </div>
          </div>
          <div className="env-row">
            <input className="search-input mono" readOnly value={clientLink} onFocus={(e) => e.target.select()} />
            <button
              className="btn btn-primary"
              onClick={() => {
                navigator.clipboard?.writeText(clientLink);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 1500);
              }}
            >
              {linkCopied ? "¡Copiado!" : "Copiar link"}
            </button>
          </div>
        </div>
      )}

      {status && (
        <div className="card">
          <h2>Configuración</h2>
          <div className="drawer-block">
            <div>Contraseña agencia (ADMIN_PASSWORD): {status.env.adminPassword ? "✓ configurada" : "✗ falta"}</div>
            <div>
              Contraseña cliente (DASHBOARD_PASSWORD): {status.env.dashboardPassword ? "✓ configurada" : "✗ falta"}
            </div>
            <div>
              Margen bruto (GROSS_MARGIN):{" "}
              {status.env.grossMargin ? `${status.env.grossMargin}%` : "no configurado (se usa 50% por defecto)"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
