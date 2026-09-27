"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DateRangePicker, { presetRange } from "../DateRangePicker";
import {
  breakdown,
  computeSummary,
  dailySeries,
  localParts,
  paymentLabel,
  previousRange,
  salesHeatmap,
  topCustomers,
  topProducts,
} from "@/lib/tiendanubeMetrics";
import SalesChart from "./SalesChart";
import { Breakdowns, SalesHeatmap, TopProducts } from "./Insights";
import { OrdersSection } from "./Orders";
import Kpi from "../Kpi";
import { delta, formatDayLabel, formatMoney, formatPercent } from "../format";

async function fetchOrders({ since, until }) {
  const res = await fetch(`/api/tiendanube/orders?since=${since}&until=${until}`);
  const data = await res.json();
  if (data.error) {
    const err = new Error(data.error);
    err.code = data.code;
    throw err;
  }
  return data;
}

export default function TiendanubePage() {
  const [range, setRange] = useState({ key: "30d", ...presetRange("30d") });
  const [orders, setOrders] = useState(null);
  const [prevOrders, setPrevOrders] = useState(null);
  const [store, setStore] = useState(null);
  const [error, setError] = useState(null);
  const [rejectedStore, setRejectedStore] = useState(null);
  const latestRequest = useRef(0);

  // El callback de OAuth redirige con ?wrong_store=<nombre> si se intento
  // conectar una tienda que no es Tout Revient.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("wrong_store")) setRejectedStore(params.get("wrong_store"));
  }, []);

  useEffect(() => {
    const requestId = ++latestRequest.current;
    setOrders(null);
    setPrevOrders(null);
    setError(null);
    // El periodo anterior es solo para comparar: si falla, seguimos sin deltas.
    const prev = fetchOrders(previousRange(range)).catch(() => null);
    fetchOrders(range)
      .then(async (data) => {
        if (requestId !== latestRequest.current) return;
        setStore(data.store);
        setOrders(data.orders);
        const prevData = await prev;
        if (requestId === latestRequest.current) setPrevOrders(prevData?.orders || null);
      })
      .catch((err) => {
        if (requestId === latestRequest.current) setError(err);
      });
  }, [range]);

  return (
    <div>
      <h1>Tiendanube</h1>
      <p style={{ color: "var(--muted)", marginTop: 0, fontSize: "0.85rem" }}>
        Tienda: {store ? `${store.name} (#${store.id})` : "Tout Revient"}
      </p>
      <DateRangePicker value={range} onChange={setRange} />

      {rejectedStore && (
        <div className="card ad-card-alert">
          <p style={{ marginTop: 0 }}>
            <strong>Se rechazó la conexión con "{rejectedStore}".</strong> Este panel es solo de Tout
            Revient. Cerrá sesión en Tiendanube, entrá con la cuenta de Tout Revient y volvé a conectar.
          </p>
        </div>
      )}

      {error && (
        <div className={"card" + (error.code === "wrong_store" ? " ad-card-alert" : "")}>
          <p style={{ color: "var(--danger)", marginTop: 0 }}>
            {error.message === "No conectado con Tiendanube todavia"
              ? "Todavía no conectaste tu cuenta de Tiendanube."
              : error.code === "wrong_store"
              ? `${error.message} Cerrá sesión en Tiendanube, entrá con la cuenta de Tout Revient y reconectá.`
              : `No pudimos traer los pedidos: ${error.message}`}
          </p>
          <a href="/api/auth/tiendanube" className="btn btn-tiendanube">
            {error.message === "No conectado con Tiendanube todavia" ? "Conectar" : "Reconectar"} Tiendanube de
            Tout Revient
          </a>
        </div>
      )}

      {!error && !orders && <LoadingSkeleton />}

      {!error && orders && orders.length === 0 && (
        <div className="card empty-state">
          No hay pedidos entre el {formatDayLabel(range.since)} y el {formatDayLabel(range.until)}. Probá con un
          rango más amplio.
        </div>
      )}

      {!error && orders && orders.length > 0 && (
        <Dashboard orders={orders} prevOrders={prevOrders} range={range} />
      )}
    </div>
  );
}

function Dashboard({ orders, prevOrders, range }) {
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const currency = orders[0]?.currency || "ARS";
  const summary = useMemo(() => computeSummary(orders), [orders]);
  const prev = useMemo(() => (prevOrders ? computeSummary(prevOrders) : null), [prevOrders]);
  const series = useMemo(() => dailySeries(orders, range.since, range.until), [orders, range]);
  const products = useMemo(() => topProducts(orders), [orders]);
  const heatmap = useMemo(() => salesHeatmap(orders), [orders]);
  const breakdownTabs = useMemo(
    () => [
      { key: "payment", label: "Medio de pago", rows: breakdown(orders, paymentLabel) },
      {
        key: "province",
        label: "Provincia",
        rows: breakdown(orders, (o) => (o.pickup ? "Retiro en local" : o.address?.province)),
      },
      {
        key: "shipping",
        label: "Envío",
        rows: breakdown(orders, (o) => (o.pickup ? "Retiro en local" : o.shipping_option)),
      },
      {
        key: "coupon",
        label: "Cupones",
        rows: breakdown(
          orders.filter((o) => o.coupons.length),
          (o) => o.coupons
        ),
        empty: "No se usaron cupones en ventas de este período.",
      },
      {
        key: "customers",
        label: "Mejores clientes",
        rows: topCustomers(orders),
        note: `${summary.repeatCustomers} de ${summary.customers} clientes compraron más de una vez en el período.`,
      },
    ],
    [orders, summary]
  );

  // Si cambian los pedidos (nuevo rango), limpiamos los filtros cruzados.
  useEffect(() => {
    setSelectedDay(null);
    setSelectedProduct(null);
  }, [orders]);

  const externalFilters = [];
  if (selectedDay) {
    externalFilters.push({
      key: "day",
      label: `Día: ${formatDayLabel(selectedDay)}`,
      test: (o) => localParts(o.created_at)?.day === selectedDay,
    });
  }
  if (selectedProduct) {
    const product = products.find((p) => p.key === selectedProduct);
    externalFilters.push({
      key: "product",
      label: `Producto: ${product?.name || ""}`,
      test: (o) => o.products.some((p) => String(p.product_id || p.name) === selectedProduct),
    });
  }

  function clearExternal(key) {
    if (key === "day") setSelectedDay(null);
    if (key === "product") setSelectedProduct(null);
  }

  function scrollToOrders() {
    document.getElementById("pedidos")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div>
      <div className="kpi-grid">
        <Kpi
          label="Facturación"
          value={formatMoney(summary.revenue, currency)}
          change={prev && delta(summary.revenue, prev.revenue)}
        />
        <Kpi
          label="Pedidos pagados"
          value={summary.paidCount}
          change={prev && delta(summary.paidCount, prev.paidCount)}
          sub={`${formatPercent(summary.conversionRate)} de los pedidos creados`}
        />
        <Kpi
          label="Ticket promedio"
          value={formatMoney(summary.avgTicket, currency)}
          change={prev && delta(summary.avgTicket, prev.avgTicket)}
        />
        <Kpi
          label="Unidades vendidas"
          value={summary.units}
          change={prev && delta(summary.units, prev.units)}
          sub={`${summary.unitsPerOrder.toFixed(1)} por pedido`}
        />
        <Kpi
          label="Clientes"
          value={summary.customers}
          change={prev && delta(summary.customers, prev.customers)}
          sub={`${summary.repeatCustomers} recompraron`}
        />
        <Kpi
          label="Pendientes de pago"
          value={formatMoney(summary.pendingAmount, currency)}
          sub={`${summary.pendingCount} pedidos sin cobrar · ${summary.cancelledCount} cancelados`}
          tone={summary.pendingCount > 0 ? "warning" : undefined}
        />
      </div>
      {prev && (
        <div className="section-sub" style={{ marginTop: -18, marginBottom: 20 }}>
          Variaciones vs. el período anterior ({formatDayLabel(previousRange(range).since)} –{" "}
          {formatDayLabel(previousRange(range).until)}). Descuentos otorgados:{" "}
          {formatMoney(summary.discountTotal, currency)} · Envíos cobrados:{" "}
          {formatMoney(summary.shippingTotal, currency)}
        </div>
      )}

      <SalesChart
        series={series}
        currency={currency}
        selectedDay={selectedDay}
        onSelectDay={(day) => {
          setSelectedDay(day);
          if (day) scrollToOrders();
        }}
      />

      <div className="two-col">
        <TopProducts
          products={products}
          totalRevenue={products.reduce((s, p) => s + p.revenue, 0)}
          currency={currency}
          selectedKey={selectedProduct}
          onSelect={(key) => {
            setSelectedProduct(key);
            if (key) scrollToOrders();
          }}
        />
        <div>
          <Breakdowns tabs={breakdownTabs} currency={currency} />
          <SalesHeatmap grid={heatmap} />
        </div>
      </div>

      <OrdersSection
        orders={orders}
        currency={currency}
        externalFilters={externalFilters}
        onClearExternal={clearExternal}
      />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div>
      <div className="kpi-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="kpi-card skeleton" style={{ height: 92 }} />
        ))}
      </div>
      <div className="card skeleton" style={{ height: 260 }} />
      <p style={{ color: "var(--muted)" }}>Cargando pedidos…</p>
    </div>
  );
}
