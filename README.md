# Meta Ads + Tiendanube — proyecto base

App Next.js con el flujo OAuth de Meta (Facebook Marketing API) ya armado.
La parte de Tiendanube queda como carpeta preparada (`app/api/auth/tiendanube/`)
para el siguiente paso.

## 1. Crear la app en Meta for Developers

1. Andá a https://developers.facebook.com/apps y creá una app de tipo
   **"Business"**.
2. En **Configuración básica**, copiá el **App ID** y el **App Secret**.
3. Agregá el producto **"Facebook Login"** (o "Facebook Login for Business"
   si vas a gestionar cuentas de clientes/agencia).
4. En Facebook Login > Configuración, agregá en **"Valid OAuth Redirect URIs"**:
   - `http://localhost:3000/api/auth/meta/callback` (desarrollo)
   - `https://tu-dominio.com/api/auth/meta/callback` (produccion)
5. Agregá también el producto **"Marketing API"**.

## 2. Permisos (scopes)

Para leer y gestionar campañas necesitás como mínimo:
- `ads_management` — crear/editar campañas
- `ads_read` — solo lectura de métricas
- `business_management` — si el usuario opera a través de un Business Manager

**Importante:** `ads_management` y `ads_read` requieren que Meta apruebe tu
app en **App Review** antes de poder usarlos con usuarios que no sean
administradores/testers de tu propia app. Mientras la app está en modo
desarrollo, funciona sin revisión para tu propia cuenta y las que agregues
como "Testers" en Roles de la app.

## 3. Configurar variables de entorno

```bash
cp .env.local.example .env.local
```

Completá `META_APP_ID`, `META_APP_SECRET` y `META_REDIRECT_URI` con los
datos del paso 1.

## 4. Instalar y correr

```bash
npm install
npm run dev
```

Abrí http://localhost:3000 y hacé click en "Conectar cuenta de Meta Ads".

## 5. Cómo funciona el flujo

1. `/api/auth/meta` redirige al usuario a la pantalla de login/permisos de
   Facebook.
2. El usuario acepta, Facebook redirige a `/api/auth/meta/callback?code=...`.
3. El callback intercambia el `code` por un access token, lo extiende a
   larga duración (~60 días) y lo guarda en una cookie `httpOnly`.
4. `lib/meta.js` tiene funciones listas para llamar a la Marketing API:
   `getAdAccounts`, `getCampaigns`, `getCampaignInsights`.
5. `/api/meta/ad-accounts` es un endpoint de ejemplo que usa esas funciones.

## 6. Siguientes pasos sugeridos

- **Base de datos**: reemplazar la cookie por almacenamiento del token
  cifrado en una DB (Postgres, etc.), asociado al usuario logueado.
- **Refresh de token**: los tokens de larga duración duran ~60 días; hay
  que renovarlos antes de que expiren.
- **Tiendanube**: el flujo es análogo (OAuth2). Cuando quieras armarlo,
  necesitás:
  - Crear una app en https://www.tiendanube.com/partners
  - `TIENDANUBE_CLIENT_ID` / `TIENDANUBE_CLIENT_SECRET`
  - El endpoint de autorización es `https://www.tiendanube.com/apps/<client_id>/authorize`
  - El intercambio de code por token va a `https://www.tiendanube.com/apps/authorize/token`
- **Seguridad**: nunca expongas `META_APP_SECRET` ni los access tokens al
  cliente (frontend). Todo el manejo de tokens debe quedar en el servidor
  (API routes), como está armado acá.

## Estructura

```
app/
  page.js                          # Landing con boton "Conectar"
  dashboard/page.js                # Placeholder post-conexion
  api/
    auth/
      meta/route.js                # Inicia OAuth con Meta
      meta/callback/route.js       # Recibe el code, obtiene el token
      tiendanube/callback/         # (a completar)
    meta/
      ad-accounts/route.js         # Ejemplo: lista cuentas publicitarias
lib/
  meta.js                          # Helpers para la Graph/Marketing API
.env.local.example
```
