import Home from "./Home";

export const dynamic = "force-dynamic";

// Margen bruto por defecto (GROSS_MARGIN en %, ej "45"). Se usa para la
// ganancia despues de publicidad y el ROAS de equilibrio.
function defaultMargin() {
  const v = parseFloat(process.env.GROSS_MARGIN);
  return isFinite(v) && v > 0 && v < 100 ? v / 100 : 0.5;
}

export default function DashboardHome() {
  return <Home defaultMargin={defaultMargin()} marginConfigured={Boolean(process.env.GROSS_MARGIN)} />;
}
