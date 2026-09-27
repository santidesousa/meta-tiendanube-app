import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAllOrders, verifyStore, wrongStoreMessage } from "@/lib/tiendanube";

// Tiendanube devuelve fechas como "2026-09-20T15:04:05+0000"; algunos
// navegadores (Safari) no parsean el offset sin ":", asi que lo normalizamos.
function isoDate(value) {
  if (!value) return null;
  return String(value).replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
}

function shippingOptionName(option) {
  if (!option) return null;
  if (typeof option === "string") return option;
  return option.name || null;
}

// Nos quedamos solo con lo que usa el dashboard: achica mucho la respuesta
// (cada pedido de Tiendanube trae decenas de campos que no mostramos).
function slimOrder(o) {
  return {
    id: o.id,
    number: o.number,
    created_at: isoDate(o.created_at),
    paid_at: isoDate(o.paid_at),
    status: o.status,
    payment_status: o.payment_status,
    shipping_status: o.shipping_status,
    currency: o.currency,
    total: parseFloat(o.total || 0),
    subtotal: parseFloat(o.subtotal || 0),
    discount: parseFloat(o.discount || 0),
    shipping_cost: parseFloat(o.shipping_cost_customer || 0),
    gateway: o.gateway_name || o.gateway || null,
    payment_method: o.payment_details?.method || null,
    installments: o.payment_details?.installments || null,
    card_company: o.payment_details?.credit_card_company || null,
    shipping_option: shippingOptionName(o.shipping_option),
    pickup: o.shipping_pickup_type === "pickup",
    coupons: (o.coupon || []).map((c) => c.code).filter(Boolean),
    note: o.note || null,
    customer: {
      id: o.customer?.id || null,
      name: o.customer?.name || o.contact_name || o.shipping_address?.name || "Sin nombre",
      email: o.customer?.email || o.contact_email || null,
      phone: o.customer?.phone || o.contact_phone || o.shipping_address?.phone || null,
    },
    address: o.shipping_address
      ? {
          street: [o.shipping_address.address, o.shipping_address.number]
            .filter(Boolean)
            .join(" "),
          floor: o.shipping_address.floor || null,
          city: o.shipping_address.city || o.shipping_address.locality || null,
          province: o.shipping_address.province || null,
          zipcode: o.shipping_address.zipcode || null,
        }
      : null,
    products: (o.products || []).map((p) => ({
      product_id: p.product_id,
      variant_id: p.variant_id,
      name: p.name_without_variants || p.name,
      full_name: p.name,
      variant: Array.isArray(p.variant_values) ? p.variant_values.join(" / ") : null,
      sku: p.sku || null,
      price: parseFloat(p.price || 0),
      quantity: parseInt(p.quantity || 0, 10),
      image: p.image?.src || null,
    })),
  };
}

// GET /api/tiendanube/orders?since=2026-09-01&until=2026-09-27
// Devuelve todos los pedidos creados en ese rango (fechas en hora de Argentina).
export async function GET(request) {
  const accessToken = cookies().get("tiendanube_access_token")?.value;
  const storeId = cookies().get("tiendanube_store_id")?.value;

  if (!accessToken || !storeId) {
    return NextResponse.json({ error: "No conectado con Tiendanube todavia" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since");
  const until = searchParams.get("until");

  const filters = {};
  if (since) filters.created_at_min = `${since}T00:00:00-03:00`;
  if (until) filters.created_at_max = `${until}T23:59:59-03:00`;

  try {
    // Chequeo en cada request: una cookie vieja de otra tienda no puede mostrar datos.
    const { ok, store } = await verifyStore(storeId, accessToken);
    if (!ok) {
      return NextResponse.json(
        { error: wrongStoreMessage(store), code: "wrong_store", store },
        { status: 403 }
      );
    }
    const data = await getAllOrders(storeId, accessToken, filters);
    return NextResponse.json({ store, orders: data.map(slimOrder) });
  } catch (err) {
    return NextResponse.json({ error: err.message, details: err.details }, { status: 400 });
  }
}
