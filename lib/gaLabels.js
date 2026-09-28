// Traducciones de los valores que devuelve GA4 (vienen en ingles).

const CHANNELS = {
  "Organic Search": "Búsqueda orgánica",
  "Paid Search": "Búsqueda paga",
  "Organic Social": "Redes (orgánico)",
  "Paid Social": "Redes (pago)",
  Direct: "Directo",
  Referral: "Referencias",
  Email: "Email",
  "Organic Shopping": "Shopping orgánico",
  "Paid Shopping": "Shopping pago",
  "Organic Video": "Video orgánico",
  "Paid Video": "Video pago",
  Display: "Display",
  "Cross-network": "Multired (Performance Max)",
  Affiliates: "Afiliados",
  SMS: "SMS",
  Audio: "Audio",
  "Mobile Push Notifications": "Notificaciones push",
  Unassigned: "Sin asignar",
};

const DEVICES = { desktop: "Computadora", mobile: "Celular", tablet: "Tablet", smarttv: "Smart TV" };

export function gaLabel(dimension, value) {
  if (!value || value === "(not set)") return "Sin dato";
  if (value === "(direct) / (none)") return "Directo";
  if (dimension === "sessionDefaultChannelGroup") return CHANNELS[value] || value;
  if (dimension === "deviceCategory") return DEVICES[value] || value;
  return value;
}
