"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Resumen" },
  { href: "/dashboard/tiendanube", label: "Tiendanube" },
  { href: "/dashboard/meta", label: "Meta Ads" },
  { href: "/dashboard/analytics", label: "Google Analytics" },
  { href: "/dashboard/conexiones", label: "Conexiones", adminOnly: true },
];

export default function Sidebar({ role, agencyName }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Al cambiar de seccion mantenemos el rango de fechas elegido.
  const keep = new URLSearchParams();
  for (const key of ["range", "since", "until"]) {
    if (searchParams.get(key)) keep.set(key, searchParams.get(key));
  }
  const query = keep.toString() ? `?${keep}` : "";

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src="/tout-revient-logo.png" alt="Tout Revient" className="brand-logo" width={320} height={69} />
        <div className="sidebar-brand-sub">{agencyName ? `Performance · ${agencyName}` : "Performance"}</div>
      </div>
      <nav className="sidebar-nav">
        {LINKS.filter((l) => !l.adminOnly || role === "admin").map((link) => (
          <Link
            key={link.href}
            href={link.adminOnly ? link.href : link.href + query}
            className={"sidebar-link" + (pathname === link.href ? " active" : "")}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <form action="/api/logout" method="post" className="sidebar-footer">
        <span className="sidebar-role">{role === "admin" ? "Agencia" : "Cliente"}</span>
        <button type="submit" className="sidebar-logout">
          Salir
        </button>
      </form>
    </aside>
  );
}
