# Deploy Tostal en Railway (sin Vercel, sin GitHub Actions)

**Política Coditeac:** un solo entorno **Production**. Deploy con **integración Git nativa de Railway**. Cero staging. Cero `.github/workflows`. Cero Vercel.

## Modelo

| Entorno Railway | Branch Git | Redeploy |
|---|---|---|
| **Production** | `production` | Cada push a `production` |

## Dominios

| App | Dominio oficial | Fallback Railway |
|---|---|---|
| **Cliente** | https://tostal.cafe (+ www) | https://tostal.up.railway.app |
| **Restaurant UI** | https://app.tostal.cafe | https://app-tostal.up.railway.app |
| **API NestJS** | https://api.tostal.cafe | URL generada de `tostal-api` |

### DNS (Namecheap) — API NestJS

| Host | Tipo | Valor |
|---|---|---|
| `api` | **CNAME** | `p4iapz5p.up.railway.app` |

Dominio ya adjunto en Railway (`tostal-api`). Hasta que Namecheap propague el CNAME, usar el fallback `https://tostal-api-production.up.railway.app`.

Los registros de `@`, `www`, `app` siguen vigentes.

## Servicios

| Service | Build / Start | Healthcheck |
|---|---|---|
| `tostal-api` | `npm --prefix apps/api ci && build` / `start:prod` | `/health` |
| `tostal-cliente` | `apps/cliente` | `/` |
| `tostal-restaurant` | `apps/restaurant` (solo UI) | `/` |
| `Postgres` | oficial | — |

Root Directory: monorepo `""` (incluye `shared/`).

## Variables

### `tostal-api`

| Variable | Notas |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `TOSTAL_AUTH_SECRET` | JWT staff + cliente |
| `TOSTAL_CORS_ORIGINS` | `https://tostal.cafe,https://www.tostal.cafe,https://app.tostal.cafe,…` |
| `TOSTAL_COOKIE_DOMAIN` | `.tostal.cafe` |
| `SUPERADMIN_EMAIL` | Email del superadmin inicial (lo elige Coditeac) |
| `SUPERADMIN_PASSWORD` | Password (≥8). Solo crea si no hay superadmin, o con `SUPERADMIN_FORCE_RESET=1` |
| `SUPERADMIN_NOMBRE` | Opcional (default `Superadmin Tostal`) |
| `SUPERADMIN_FORCE_RESET` | `1` para forzar update/creación con el email/password actuales |
| `RESEND_API_KEY` | API key Resend; sin ella → mock |
| `RESEND_FROM` | Ej. `Tostal <pedidos@tostal.cafe>` (dominio verificado en Resend) |
| `MAIL_MOCK` | `0` con key real; `1` fuerza mock/log |
| `STAFF_NOTIFY_EMAIL` | Opcional; CSV de emails staff para aviso de pedido nuevo. Default: emails de superadmin/admin activos |
| `STRIPE_SECRET_KEY` | opcional; sin clave = **mock** |
| `STRIPE_WEBHOOK_SECRET` | firma webhook → `estadoPago=pagado` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | publishable key (cliente) |
| `STRIPE_CURRENCY` | default `mxn` |
| `NIXPACKS_NODE_VERSION` | `22` |
| `PORT` | Railway lo inyecta |
| `MEDIA_DIR` | Volumen fotos (`/data/uploads`). Montar volumen Railway en `/data` |
| `PUBLIC_API_URL` | Base absoluta para URLs de media (`https://api.tostal.cafe`) |
| `S3_BUCKET` / `S3_ENDPOINT` / `S3_*` | Opcional R2/S3; si hay bucket+endpoint+keys, sube ahí en vez del volumen |

**Email:** Resend SDK. Sin `RESEND_API_KEY` o con `MAIL_MOCK=1` → log `[mail:mock]` + `email_log`.  
DNS Resend: verificar `tostal.cafe` (SPF/DKIM en panel Resend) antes de usar `pedidos@tostal.cafe`.

**Sin datos demo:** el bootstrap no inserta menú ni `admin@tostal.mx`. Tras el primer deploy con `SUPERADMIN_*`, entra en https://app.tostal.cafe y crea catálogo/staff a mano. La purga `demo_purged_v1` borra una vez el seed demo legado.

**Stripe = solo procesador.** No crear Products/Prices/Catalog en Stripe.
Productos, precios y duraciones viven en Postgres (admin Tostal). Al cobrar:
`POST /api/pagos/stripe/intent` (PaymentIntent amount del pedido) o
`POST /api/pagos/stripe/checkout` (Checkout Session `line_items[].price_data` ad-hoc).
Metadata: `pedidoId`, `codigo`. Webhook: `POST /api/pagos/stripe/webhook`.
Transferencia (confirmación manual staff) y contra entrega siguen activos.

### `tostal-cliente` / `tostal-restaurant`

| Variable | Notas |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.tostal.cafe` (o fallback Railway de la API) |
| `NEXT_PUBLIC_TOSTAL_API_URL` | mismo |

Restaurant **ya no** necesita `DATABASE_URL` ni `TOSTAL_AUTH_SECRET` (solo UI).

## URLs

| App | URL |
|---|---|
| Cliente | https://tostal.cafe |
| Restaurant UI | https://app.tostal.cafe |
| API | https://api.tostal.cafe |

Dashboard: https://railway.app/project/6bca767c-9912-4c69-8879-6da93bbfb227

## SSE

- Público: `GET https://api.tostal.cafe/api/public/pedidos/events?codigo=T-…`
- Staff: `GET https://api.tostal.cafe/api/pedidos/events?fecha=…` (cookie + credentials)

## GitHub

Repo: https://github.com/coditeac/tostal — rama **`production`**.
