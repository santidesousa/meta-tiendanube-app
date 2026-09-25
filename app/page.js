export default function Home() {
  return (
    <main>
      <h1>Meta Ads + Tiendanube</h1>
      <p>Conecta tus cuentas para empezar.</p>
      <a
        href="/api/auth/meta"
        style={{
          display: "inline-block",
          background: "#1877F2",
          color: "white",
          padding: "10px 18px",
          borderRadius: 6,
          textDecoration: "none",
          marginTop: "1rem",
        }}
      >
        Conectar cuenta de Meta Ads
      </a>
    </main>
  );
}
