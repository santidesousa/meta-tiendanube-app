import { NextResponse } from "next/server";
import { getAllProducts } from "@/lib/tiendanube";
import { cached } from "@/lib/cache";
import { assertAllowedStore, errorResponse, requireTiendanube } from "../../_shared/route-helpers";

function i18n(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.es || value.pt || value.en || Object.values(value)[0] || "";
}

// GET /api/tiendanube/stock
// Stock actual por producto y variante. stock === null significa ilimitado
// (la variante no gestiona stock).
export async function GET() {
  try {
    const creds = requireTiendanube();
    const { data, generatedAt } = await cached("tiendanube", ["stock", creds.storeId], async () => {
      await assertAllowedStore(creds);
      const products = await getAllProducts(creds.storeId, creds.token);
      const out = {};
      for (const p of products) {
        const variants = (p.variants || []).map((v) => ({
          id: v.id,
          label: (v.values || []).map(i18n).filter(Boolean).join(" / ") || "Única",
          stock: v.stock_management === false || v.stock === null || v.stock === undefined ? null : Number(v.stock),
        }));
        const managed = variants.filter((v) => v.stock !== null);
        out[p.id] = {
          name: i18n(p.name),
          published: p.published !== false,
          stock: managed.length ? managed.reduce((s, v) => s + Math.max(0, v.stock), 0) : null,
          outOfStockVariants: managed.filter((v) => v.stock <= 0).map((v) => v.label),
          variants,
        };
      }
      return { products: out };
    });
    return NextResponse.json({ ...data, generatedAt });
  } catch (err) {
    return errorResponse(err);
  }
}
