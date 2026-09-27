export default function Dashboard() {
  return (
    <div>
      <h1>Home</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Resumen general. Próximamente: insights cruzados de Tiendanube y Meta
        Ads en un solo lugar.
      </p>
      <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
        <a href="/api/auth/meta" className="btn btn-meta">
          Conectar cuenta de Meta Ads
        </a>
        <a href="/api/auth/tiendanube" className="btn btn-tiendanube">
          Conectar cuenta de Tiendanube
        </a>
      </div>
    </div>
  );
}
