import { NextResponse } from "next/server";
import { getAllAbandonedCheckouts } from "@/lib/tiendanube";
import { cached } from "@/lib/cache";
import { assertAllowedStore, errorResponse, requireRange, requireTiendanube } from "../../_shared/route-helpers";

// GET /api/tiendanube/abandoned?since=2026-09-01&until=2026-09-27
// Carritos abandonados del periodo: cuanta plata quedo sin cerrar y el link
// de recuperacion de cada uno (para mandarle al cliente).
export async function GET(request) {
  try {
    const creds = requireTiendanube();
    const range = requireRange(request);
    const { data, generatedAt } = await cached(
      "tiendanube",
      ["abandoned", creds.storeId, range.since, range.until],
      async () => {
        await assertAllowedStore(creds);
        const checkouts = await getAllAbandonedCheckouts(creds.storeId, creds.token, {
          created_at_min: `${range.since}T00:00:00-03:00`,
          created_at_max: `${range.until}T23:59:59-03:00`,
        });
        const items = checkouts
          .filter((c) => !c.completed_at)
          .map((c) => ({
            id: c.id,
            created_at: c.created_at ? String(c.created_at).replace(/([+-]\d{2})(\d{2})$/, "$1:$2") : null,
            total: parseFloat(c.total || 0),
            currency: c.currency,
            name: c.contact_name || c.billing_name || null,
            email: c.contact_email || null,
            phone: c.contact_phone || null,
            recoveryUrl: c.abandoned_checkout_url || null,
            products: (c.products || []).map((p) => ({
              name: p.name,
              quantity: parseInt(p.quantity || 0, 10),
              image: p.image?.src || null,
            })),
          }))
          .sort((a, b) => b.total - a.total);
        return { count: items.length, total: items.reduce((s, i) => s + i.total, 0), items };
      }
    );
    return NextResponse.json({ ...data, generatedAt });
  } catch (err) {
    return errorResponse(err);
  }
}
