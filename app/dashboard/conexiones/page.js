"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "../api";

const SOURCE = {
  env: { label: "Conectado para todos (Vercel)", cls: "badge-active" },
  cookie: { label: "Conectado solo en este navegador", cls: "badge-paused" },
};

function SourceBadge({ source }) {
  const s = SOURCE[source] || { label: "No conectado", cls: "badge-danger" };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

function daysUntil(iso) {
  return Math.round((new Date(iso) - Date.now()) / 86400000);
}

export default function ConexionesPage() {
  const [status, setStatus] = useState(null);
  const [tokens, setTokens] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [clientLink, setClientLink] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) setNotice(`Listo: se conectó ${params.get("connected") === "meta" ? "Meta" : "Tiendanube"} en este navegador.`);
    if (params.get("wrong_store"))
      setNotice(`Se rechazó la tienda "${params.get("wrong_store")}": este panel es solo de Tout Revient. Cerrá sesión en Tiendanube, entrá con Tout Revient y volvé a conectar.`);
    fetchJson("/api/admin/connections").then(setStatus).catch((e) => setError(e.message));
    fetchJson("/api/admin/client-link").then((d) => setClientLink(d.url)).catch(() => {});
  }, []);

  async function revealTokens() {
    setTokens(await fetchJson("/api/admin/tokens"));
  }

  if (error) return <p style={{ color: "var(--danger)" }}>{error}</p>;

  const meta = status?.meta;
  const tn = status?.tiendanube;
  const metaDays = meta?.token?.expiresAt ? daysUntil(meta.token.expiresAt) : null;
  // Solo ofrecemos copiar lo que esta conectado en este navegador y es valido.
  const copyable = tokens && [
    meta?.source === "cookie" && meta.account && ["META_ACCESS_TOKEN", tokens.META_ACCESS_TOKEN],
    tn?.source === "cookie" && tn.ok && ["TIENDANUBE_ACCESS_TOKEN", tokens.TIENDANUBE_ACCESS_TOKEN],
    tn?.source === "cookie" && tn.ok && ["TIENDANUBE_STORE_ID", tokens.TIENDANUBE_STORE_ID],
  ].filter((x) => x && x[1]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Conexiones</h1>
          <p className="page-sub">Solo visible para la agencia.</p>
        </div>
      </div>

      {notice && <div className="card insight-banner">{notice}</div>}

      {status && (meta.source !== "env" || tn.source !== "env") && (
        <div className="card kpi-warning">
          <strong>Tu clienta todavía no ve los datos.</strong>
          <div className="small" style={{ marginTop: 4 }}>
            {meta.source === "cookie" || tn.source === "cookie"
              ? "Lo que conectaste quedó guardado solo en este navegador. "
              : ""}
            Para que cualquiera con el link vea la información, seguí los pasos de “Dejar el panel conectado para
            todos” (más abajo): copiar los valores a Vercel y hacer Redeploy.
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
      {!status && <div className="card skeleton" style={{ height: 200 }} />}

      {status && (
        <div className="two-col two-col-even" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="card">
            <div className="section-head">
              <h2>Meta Ads</h2>
              <SourceBadge source={meta.source} />
            </div>
            <div className="drawer-block">
              <div>
                Cuenta: <b>{meta.account ? meta.account.name : "—"}</b>{" "}
                <span className="muted mono small">{status.expected.adAccountId}</span>
              </div>
              {meta.error && <div className="alert-note">No se pudo leer la cuenta: {meta.error}</div>}
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
              {meta.source ? "Reconectar" : "Conectar"} Meta
            </a>
          </div>

          <div className="card">
            <div className="section-head">
              <h2>Tiendanube</h2>
              <SourceBadge source={tn.source} />
            </div>
            <div className="drawer-block">
              <div>
                Tienda: <b>{tn.store ? tn.store.name : "—"}</b>{" "}
                {tn.store && <span className="muted mono small">#{tn.store.id}</span>}
              </div>
              {tn.store && !tn.ok && <div className="alert-note">No es Tout Revient: el panel la bloquea.</div>}
              {tn.error && <div className="alert-note">{tn.error}</div>}
              {!status.expected.storeId && (
                <div className="muted small" style={{ marginTop: 4 }}>
                  TIENDANUBE_STORE_ID no está configurado: se valida por nombre de tienda.
                </div>
              )}
            </div>
            <a href="/api/auth/tiendanube" className="btn btn-tiendanube" style={{ marginTop: 12 }}>
              {tn.source ? "Reconectar" : "Conectar"} Tiendanube
            </a>
          </div>
        </div>
      )}

      {status && (
        <div className="card">
          <h2>Dejar el panel conectado para todos</h2>
          <ol className="steps">
            <li>Conectá Meta y Tiendanube acá (en Tiendanube, logueado con la cuenta de Tout Revient).</li>
            <li>Tocá “Mostrar valores” y copiá cada uno.</li>
            <li>
              En Vercel → proyecto → Settings → Environment Variables, pegalos con esos nombres y volvé a deployar.
            </li>
            <li>Cuando esta página diga “Conectado para todos (Vercel)”, el cliente ya ve los datos con su contraseña.</li>
          </ol>
          <p className="muted small">
            Recomendado para Meta: generar un token de <b>usuario del sistema</b> en Business Manager (no vence). Un
            token de usuario común vence a los ~60 días y hay que renovarlo.
          </p>
          {!tokens && (
            <button className="btn btn-primary" onClick={revealTokens}>
              Mostrar valores
            </button>
          )}
          {tokens && copyable.length === 0 && (
            <p className="muted">No hay nada nuevo para copiar desde este navegador.</p>
          )}
          {tokens &&
            copyable.map(([name, value]) => (
              <div key={name} className="env-row">
                <code className="env-name">{name}</code>
                <input className="search-input mono" readOnly value={value} onFocus={(e) => e.target.select()} />
                <button className="btn btn-primary" onClick={() => navigator.clipboard?.writeText(value)}>
                  Copiar
                </button>
              </div>
            ))}
        </div>
      )}

      {status && (
        <div className="card">
          <h2>Acceso y configuración</h2>
          <div className="drawer-block">
            <div>
              Contraseña agencia (ADMIN_PASSWORD): {status.env.adminPassword ? "✓ configurada" : "✗ falta"}
            </div>
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
