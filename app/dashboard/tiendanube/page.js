"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDateRange } from "../DateRangePicker";
import PageHeader, { oldest } from "../PageHeader";
import {
  breakdown,
  computeSummary,
  dailySeries,
  daysBetween,
  localParts,
  paymentLabel,
  previousRange,
  salesHeatmap,
  topCustomers,
  topProducts,
} from "@/lib/tiendanubeMetrics";
import { fetchJson } from "../api";
import { ConnectionHint } from "../RoleContext";
import SalesChart from "./SalesChart";
import { Breakdowns, SalesHeatmap, TopProducts } from "./Insights";
import { OrdersSection } from "./Orders";
import AbandonedCarts from "./AbandonedCarts";
import Kpi from "../Kpi";
import {
  delta,
  formatCompactMoney,
  formatDayLabel,
  formatMoney,
  formatNumber,
  formatPercent,
} from "../format";

const NOT_CONNECTED = "No conectado con Tiendanube todavia";

export default function TiendanubePage() {
  const [range, setRange] = useDateRange();
  const [orders, setOrders] = useState(null);
  const [store, setStore] = useState(null);
  const [prevSummary, setPrevSummary] = useState(null);
  const [abandoned, setAbandoned] = useState(null);
  const [stock, setStock] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [error, setError] = useState(null);
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    if (!range) return;
    const requestId = ++latestRequest.current;
    const current = () => requestId === latestRequest.current;
    setOrders(null);
    setPrevSummary(null);
    setAbandoned(null);
    setError(null);
    const q = (r) => `since=${r.since}&until=${r.until}`;

    // Lo secundario (comparacion, carritos, stock) no bloquea: si falla, la
    // pagina se muestra igual sin esa parte.
    const prev = fetchJson(`/api/tiendanube/orders?${q(previousRange(range))}&summary=1`).catch(() => null);
    fetchJson(`/api/tiendanube/abandoned?${q(range)}`)
      .then((d) => current() && setAbandoned(d))
      .catch(() => current() && setAbandoned({ unavailable: true }));
    fetchJson(`/api/tiendanube/stock`)
      .then((d) => current() && setStock(d.products))
      .catch(() => {});

    try {
      const data = await fetchJson(`/api/tiendanube/orders?${q(range)}`);
      if (!current()) return;
      setStore(data.store);
      setOrders(data.orders);
      setGeneratedAt(data.generatedAt);
      const p = await prev;
      if (current()) setPrevSummary(p?.summary || null);
    } catch (err) {
      if (current()) setError(err);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Tiendanube"
        subtitle={store ? `Tienda: ${store.name} (#${store.id})` : "Tienda: Tout Revient"}
        range={range}
        onRangeChange={setRange}
        generatedAt={oldest(generatedAt, abandoned?.generatedAt)}
        onRefresh={load}
      />

      {error && (
        <div className={"card" + (error.code === "wrong_store" ? " ad-card-alert" : "")}>
          <p style={{ color: "var(--danger)", marginTop: 0 }}>
            {error.message === NOT_CONNECTED
              ? "Tiendanube todavía no está conectado."
              : error.code === "wrong_store"
              ? `${error.message} Hay que reconectar con la cuenta de Tout Revient.`
              : `No pudimos traer los pedidos: ${error.message}`}
          </p>
          <ConnectionHint className="btn btn-tiendanube" />
        </div>
      )}

      {!error && range && !orders && <LoadingSkeleton />}

      {!error && orders && orders.length === 0 && (
        <div className="card empty-state">
          No hay pedidos entre el {formatDayLabel(range.since)} y el {formatDayLabel(range.until)}. Probá con un
          rango más amplio.
        </div>
      )}

      {!error && orders && orders.length > 0 && (
        <Dashboard orders={orders} prev={prevSummary} range={range} abandoned={abandoned} stock={stock} />
      )}
    </div>
  );
}

function Dashboard({ orders, prev, range, abandoned, stock }) {
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const currency = orders[0]?.currency || "ARS";
  const summary = useMemo(() => computeSummary(orders, range), [orders, range]);
  const series = useMemo(() => dailySeries(orders, range.since, range.until), [orders, range]);
  const products = useMemo(() => topProducts(orders), [orders]);
  const heatmap = useMemo(() => salesHeatmap(orders), [orders]);
  const days = daysBetween(range.since, range.until);
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

  const d = (key) => (prev ? delta(summary[key], prev[key]) : null);
  const hasNew = summary.newCustomers !== null;

  return (
    <div>
      <div className="kpi-hero-row">
        <Kpi
          hero
          label="Facturación"
          value={formatCompactMoney(summary.revenue, currency)}
          title={formatMoney(summary.revenue, currency)}
          change={d("revenue")}
          sub={`${formatMoney(summary.revenue / days, currency)} por día`}
        />
        <Kpi
          hero
          label="Pedidos pagados"
          value={formatNumber(summary.paidCount)}
          change={d("paidCount")}
          sub={`${formatPercent(summary.conversionRate)} de los pedidos creados se pagó`}
        />
        <Kpi
          hero
          label="Ticket promedio"
          value={formatMoney(summary.avgTicket, currency)}
          change={d("avgTicket")}
          sub={`${summary.unitsPerOrder.toFixed(1)} unidades por pedido`}
        />
      </div>

      <div className="kpi-grid kpi-secondary">
        <Kpi label="Unidades vendidas" value={formatNumber(summary.units)} change={d("units")} />
        {hasNew ? (
          <Kpi
            label="Clientes nuevos"
            value={formatNumber(summary.newCustomers)}
            change={d("newCustomers")}
            sub={`${summary.customers ? formatPercent(summary.newCustomers / summary.customers) : "—"} de los compradores · ${formatCompactMoney(summary.newCustomersRevenue, currency)}`}
          />
        ) : (
          <Kpi label="Clientes" value={formatNumber(summary.customers)} change={d("customers")} />
        )}
        <Kpi
          label="Clientes recurrentes"
          value={formatNumber(hasNew ? summary.returningCustomers : summary.repeatCustomers)}
          sub={hasNew ? "Ya habían comprado antes del período" : "Compraron más de una vez en el período"}
        />
        <Kpi
          label="Pendientes de pago"
          value={formatCompactMoney(summary.pendingAmount, currency)}
          title={formatMoney(summary.pendingAmount, currency)}
          sub={`${summary.pendingCount} pedidos sin cobrar`}
          tone={summary.pendingCount > 0 ? "warning" : undefined}
        />
        <Kpi
          label="Cancelaciones"
          value={formatPercent(summary.cancelRate, 1)}
          change={d("cancelRate")}
          inverse
          sub={`${summary.cancelledCount} pedidos · ${formatCompactMoney(summary.cancelledAmount, currency)}`}
          tone={summary.cancelRate > 0.1 ? "danger" : undefined}
        />
        {abandoned && !abandoned.unavailable && (
          <Kpi
            label="Carritos abandonados"
            value={formatCompactMoney(abandoned.total, currency)}
            title={formatMoney(abandoned.total, currency)}
            sub={`${abandoned.count} carritos sin terminar`}
            tone={abandoned.total > summary.revenue * 0.2 ? "warning" : undefined}
          />
        )}
      </div>
      <div className="section-sub" style={{ marginTop: -10, marginBottom: 20 }}>
        Descuentos otorgados: {formatMoney(summary.discountTotal, currency)} · Envíos cobrados:{" "}
        {formatMoney(summary.shippingTotal, currency)}
        {hasNew && " · Cliente nuevo = su primera compra en la tienda fue en este período."}
      </div>

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
          stock={stock}
          days={days}
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

      {abandoned && <AbandonedCarts data={abandoned} currency={currency} />}

      <OrdersSection
        orders={orders}
        currency={currency}
        range={range}
        externalFilters={externalFilters}
        onClearExternal={clearExternal}
      />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div>
      <div className="kpi-hero-row">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="kpi-card kpi-hero skeleton" style={{ height: 118 }} />
        ))}
      </div>
      <div className="kpi-grid kpi-secondary">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="kpi-card skeleton" style={{ height: 84 }} />
        ))}
      </div>
      <div className="card skeleton" style={{ height: 260 }} />
    </div>
  );
}
