# Tout Revient · Panel de performance

Dashboard en Next.js que cruza las ventas de **Tiendanube** con la inversión
en **Meta Ads** de Tout Revient. Deploy automático en Vercel al hacer push a
`main`.

## Secciones

- **Resumen**: facturación, inversión, ROAS real, ganancia después de
  publicidad (con margen configurable), costo por cliente nuevo, gráfico
  facturación vs. inversión y alertas automáticas ("Qué mirar").
- **Tiendanube**: KPIs con comparación vs. período anterior, ventas por día,
  productos más vendidos con stock, desgloses, horarios de compra, carritos
  abandonados y pedidos con detalle.
- **Meta Ads**: KPIs, evolución diaria, embudo, desgloses por
  edad/plataforma/región/hora, campañas y creatividades (con alertas de
  anuncios sin ventas y de fatiga).
- **Conexiones** (solo agencia): estado de las conexiones, vencimiento del
  token de Meta y valores para copiar a Vercel.

Todas las páginas: rango de fechas en la URL (links compartibles),
exportación a CSV, descarga en PDF (imprimir → guardar como PDF) y versión
para celular.

## Acceso

El panel pide contraseña (`middleware.js`):

| Rol     | Variable             | Puede                                   |
|---------|----------------------|-----------------------------------------|
| Agencia | `ADMIN_PASSWORD`     | Ver todo, conectar cuentas, Conexiones  |
| Cliente | `DASHBOARD_PASSWORD` | Ver los datos (solo lectura)            |

Sin ninguna de las dos configurada, nadie puede entrar.

## Puesta en marcha

1. En Vercel → Settings → Environment Variables, cargá las variables de
   `.env.local.example` (como mínimo las contraseñas y las de las apps de
   Meta y Tiendanube). Volvé a deployar.
2. Entrá con la contraseña de agencia y andá a **Conexiones**.
3. Conectá Meta y Tiendanube (en Tiendanube, logueado con la cuenta de
   Tout Revient: cualquier otra tienda se rechaza).
4. Tocá **Mostrar valores** y copiá `META_ACCESS_TOKEN`,
   `TIENDANUBE_ACCESS_TOKEN` y `TIENDANUBE_STORE_ID` a Vercel. Redeploy.
5. En Conexiones, copiá el **link para tu clienta** y mandáselo: entra
   directo, sin contraseña y en solo lectura (también puede entrar con
   `DASHBOARD_PASSWORD`). Para invalidar el link, cambiá esa contraseña.

El token de Meta de usuario vence a los ~60 días (Conexiones avisa). Para
evitarlo, usá un token de **usuario del sistema** de Business Manager.

## Datos y caché

Las respuestas de Meta y Tiendanube se cachean 10 minutos en el servidor
(`lib/cache.js`). El botón **Actualizar** de cada página fuerza datos
frescos.

## Desarrollo

```bash
cp .env.local.example .env.local   # y completar
npm install
npm run dev
```

Estructura principal:

- `lib/` — clientes de las APIs (`meta.js`, `tiendanube.js`), métricas
  (`metaMetrics.js`, `tiendanubeMetrics.js`), alertas, sesión, caché.
- `app/api/` — endpoints; `_shared/route-helpers.js` concentra credenciales,
  validación de rango y la verificación de tienda/cuenta.
- `app/dashboard/` — páginas y componentes compartidos (`PageHeader`, `Kpi`,
  `BarChart`, `ComboChart`, `csv.js`).
