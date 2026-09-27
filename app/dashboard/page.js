async function getAdAccounts() {
  const res = await fetch(`${process.env.APP_URL}/api/meta/ad-accounts`, {
    cache: "no-store",
    headers: { cookie: "" }, // en server components reales, propaga cookies() aca
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function Dashboard() {
  return (
    <main>
      <h1>Home</h1>
      <p style={{ color: "#666" }}>
        Resumen general (próximamente: insights cruzados de Tiendanube y Meta
        Ads). Por ahora, conectá tus cuentas si todavía no lo hiciste.
      </p>
      <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
        <a
          href="/api/auth/meta"
          style={{
            display: "inline-block",
            background: "#1877F2",
            color: "white",
            padding: "10px 18px",
            borderRadius: 6,
            textDecoration: "none",
          }}
        >
          Conectar cuenta de Meta Ads
        </a>
        <a
          href="/api/auth/tiendanube"
          style={{
            display: "inline-block",
            background: "#00BCD4",
            color: "white",
            padding: "10px 18px",
            borderRadius: 6,
            textDecoration: "none",
          }}
        >
          Conectar cuenta de Tiendanube
        </a>
      </div>
    </main>
  );
}
