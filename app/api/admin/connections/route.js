import { NextResponse } from "next/server";
import { getGaCredentials, getMetaCredentials, getTiendanubeCredentials } from "@/lib/credentials";
import { runReport } from "@/lib/googleAnalytics";
import { ALLOWED_AD_ACCOUNT_ID, getAdAccount, metaFetch } from "@/lib/meta";
import { verifyStore } from "@/lib/tiendanube";

export const dynamic = "force-dynamic";

// Vencimiento y validez del token de Meta. Los tokens de usuario duran ~60
// dias; los de "usuario del sistema" del Business Manager no vencen.
async function metaTokenInfo(token) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return null;
  try {
    const { data } = await metaFetch("/debug_token", `${appId}|${appSecret}`, { input_token: token });
    return {
      valid: data.is_valid,
      expiresAt: data.expires_at ? new Date(data.expires_at * 1000).toISOString() : null,
      neverExpires: data.expires_at === 0,
      type: data.type,
    };
  } catch {
    return null;
  }
}

// GET /api/admin/connections  (solo agencia, ver middleware)
export async function GET() {
  const meta = getMetaCredentials();
  const tn = getTiendanubeCredentials();
  const ga = getGaCredentials();

  const result = {
    meta: { source: meta?.source || null },
    tiendanube: { source: tn?.source || null },
    ga: {
      source: ga && !ga.error ? "env" : null,
      propertyId: ga?.propertyId || process.env.GA_PROPERTY_ID || null,
      clientEmail: ga?.clientEmail || null,
      error: ga?.error || null,
    },
    env: {
      adminPassword: Boolean(process.env.ADMIN_PASSWORD),
      dashboardPassword: Boolean(process.env.DASHBOARD_PASSWORD),
      grossMargin: process.env.GROSS_MARGIN || null,
    },
    expected: { adAccountId: ALLOWED_AD_ACCOUNT_ID, storeId: process.env.TIENDANUBE_STORE_ID || null },
  };

  if (meta) {
    const [account, tokenInfo] = await Promise.all([
      getAdAccount(meta.token, ALLOWED_AD_ACCOUNT_ID).catch((err) => ({ error: err.message })),
      metaTokenInfo(meta.token),
    ]);
    result.meta.account = account.error ? null : { id: ALLOWED_AD_ACCOUNT_ID, name: account.name };
    result.meta.error = account.error || null;
    result.meta.token = tokenInfo;
  }

  if (tn) {
    try {
      const { ok, store } = await verifyStore(tn.storeId, tn.token);
      result.tiendanube.store = store;
      result.tiendanube.ok = ok;
    } catch (err) {
      result.tiendanube.error = err.message;
    }
  }

  // GA: una consulta minima para confirmar que la cuenta de servicio tiene
  // acceso a la propiedad.
  if (ga && !ga.error) {
    try {
      await runReport(ga, { dateRanges: [{ since: "7daysAgo", until: "today" }], metrics: ["sessions"], limit: 1 });
      result.ga.ok = true;
    } catch (err) {
      result.ga.ok = false;
      result.ga.error = err.message;
    }
  }

  return NextResponse.json(result);
}
