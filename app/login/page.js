import { authConfigured } from "@/lib/session";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage({ searchParams }) {
  return (
    <main className="login-shell">
      <div className="login-card">
        <div className="brand-mark brand-mark-lg">TR</div>
        <h1>Tout Revient</h1>
        <p className="muted" style={{ marginTop: 0 }}>Panel de performance</p>
        {authConfigured() ? (
          <LoginForm next={searchParams?.next} />
        ) : (
          <div className="login-setup">
            <strong>Falta configurar el acceso.</strong>
            <p>
              En Vercel → Settings → Environment Variables, agregá <code>ADMIN_PASSWORD</code> (agencia) y{" "}
              <code>DASHBOARD_PASSWORD</code> (cliente), y volvé a deployar.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
