export const metadata = {
  title: "Meta Ads + Tiendanube",
  description: "Integracion de Meta Marketing API y Tiendanube",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
        {children}
      </body>
    </html>
  );
}
