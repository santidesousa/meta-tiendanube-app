import { Suspense } from "react";
import { cookies } from "next/headers";
import { SESSION_COOKIE, readSessionValue } from "@/lib/session";
import Sidebar from "./Sidebar";
import { RoleProvider } from "./RoleContext";

export default async function DashboardLayout({ children }) {
  const session = await readSessionValue(cookies().get(SESSION_COOKIE)?.value);

  return (
    <div className="app-shell">
      <Suspense fallback={<aside className="sidebar" />}>
        <Sidebar role={session?.role} agencyName={process.env.NEXT_PUBLIC_AGENCY_NAME || null} />
      </Suspense>
      <main className="content">
        <RoleProvider role={session?.role}>{children}</RoleProvider>
      </main>
    </div>
  );
}
