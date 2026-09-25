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
      <h1>Dashboard</h1>
      <p>
        Cuenta de Meta conectada. Este es un placeholder: llama a{" "}
        <code>/api/meta/ad-accounts</code> desde el cliente (fetch con
        credenciales) para listar las cuentas publicitarias y sus campanas.
      </p>
    </main>
  );
}
