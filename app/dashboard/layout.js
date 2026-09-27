"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/tiendanube", label: "Tiendanube" },
  { href: "/dashboard/meta", label: "Meta Ads" },
];

export default function DashboardLayout({ children }) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">Tout Revient</div>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={
              "sidebar-link" + (pathname === link.href ? " active" : "")
            }
          >
            {link.label}
          </Link>
        ))}
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
