import Link from "next/link";

const tabStyle = {
  padding: "10px 18px",
  textDecoration: "none",
  color: "#111",
  borderBottom: "3px solid transparent",
  fontWeight: 600,
};

export default function DashboardLayout({ children }) {
  return (
    <div>
      <nav
        style={{
          display: "flex",
          gap: "0.5rem",
          borderBottom: "1px solid #e2e2e2",
          marginBottom: "2rem",
        }}
      >
        <Link href="/dashboard" style={tabStyle}>
          Home
        </Link>
        <Link href="/dashboard/tiendanube" style={tabStyle}>
          Tiendanube
        </Link>
        <Link href="/dashboard/meta" style={tabStyle}>
          Meta Ads
        </Link>
      </nav>
      <div style={{ padding: "0 0.5rem" }}>{children}</div>
    </div>
  );
}
