"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDateRange } from "../DateRangePicker";
import PageHeader, { oldest } from "../PageHeader";
import {
  breakdown,
  computeSummary,
  periodSeries,
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
import MetricCards from "../MetricCards";
import Evolution from "../Evolution";
import { CARD_KEYS, EVOLUTION_DEFAULT, metricDefs } from "./metricDefs";
import { Breakdowns, SalesHeatmap, TopProducts } from "./Insights";
import { OrdersSection } from "./Orders";
import AbandonedCarts from "./AbandonedCarts";
import {
  formatCompactMoney,
  formatDayLabel,
  formatNumber,
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
              ? "Datos no disponibles, contactá al administrador."
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
  const defs = useMemo(() => metricDefs(currency), [currency]);
  const dailyKpis = useMemo(() => periodSeries(orders, range.since, range.until, 1), [orders, range]);
  const weeklyKpis = useMemo(() => periodSeries(orders, range.since, range.until, 7), [orders, range]);
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

  const hasNew = summary.newCustomers !== null;
  // Si Tiendanube no manda la fecha de alta del cliente, no se puede separar
  // nuevos de recurrentes: mostramos clientes totales y los que recompraron.
  const cardKeys = hasNew
    ? CARD_KEYS
    : CARD_KEYS.map((k) => (k === "newCustomers" ? "customers" : k === "returningCustomers" ? "repeatCustomers" : k));
  const evolutionKeys = cardKeys;

  return (
    <div>
      <MetricCards defs={defs} keys={cardKeys} current={summary} previous={prev} series={dailyKpis} />

      <div className="stat-strip">
        <span className={summary.pendingCount ? "text-warn" : ""}>
          Pendientes de pago <b>{formatCompactMoney(summary.pendingAmount, currency)}</b> ({summary.pendingCount})
        </span>
        {abandoned && !abandoned.unavailable && (
          <span>
            Carritos abandonados <b>{formatCompactMoney(abandoned.total, currency)}</b> ({abandoned.count})
          </span>
        )}
        <span>
          Clientes <b>{formatNumber(summary.customers)}</b>
        </span>
        <span>
          Unidades por pedido <b>{summary.unitsPerOrder.toFixed(1)}</b>
        </span>
        <span>
          Descuentos <b>{formatCompactMoney(summary.discountTotal, currency)}</b>
        </span>
        <span>
          Envíos cobrados <b>{formatCompactMoney(summary.shippingTotal, currency)}</b>
        </span>
      </div>
      <div className="section-sub" style={{ marginBottom: 16 }}>
        {prev
          ? `Variaciones vs. ${formatDayLabel(previousRange(range).since)} – ${formatDayLabel(previousRange(range).until)} (mismos días inmediatamente anteriores). Verde = mejora, rojo = empeora.`
          : "Sin datos del período anterior para comparar."}
        {hasNew && " Cliente nuevo = su primera compra en la tienda fue en este período."}
      </div>

      <Evolution
        defs={defs}
        toggleKeys={evolutionKeys}
        defaultOn={EVOLUTION_DEFAULT}
        weekly={weeklyKpis}
        daily={dailyKpis}
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
      <div className="metric-cards">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="metric-card skeleton" style={{ height: 150 }} />
        ))}
      </div>
      <div className="card skeleton" style={{ height: 380 }} />
    </div>
  );
}
