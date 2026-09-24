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

### DNS (Namecheap) — añadir API

| Host | Tipo | Valor |
|---|---|---|
| `api` | **CNAME** | hostname Railway de `tostal-api` (ej. `….up.railway.app`) |
| `_railway-verify.api` | **TXT** | el que muestre Railway al adjuntar el dominio |

Los registros de `@`, `www`, `app` siguen vigentes (ver historial de Domains en Railway).

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
| `TOSTAL_CORS_ORIGINS` | `https://tostal.cafe,https://www.tostal.cafe,https://app.tostal.cafe,https://tostal.up.railway.app,https://app-tostal.up.railway.app` |
| `TOSTAL_COOKIE_DOMAIN` | `.tostal.cafe` |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` / `MAIL_FROM` | email real; sin ellas = mock en logs |
| `STRIPE_SECRET_KEY` | opcional; sin clave = mock PaymentIntent |
| `STRIPE_WEBHOOK_SECRET` | firma webhook |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Elements/Checkout cliente |
| `STRIPE_CURRENCY` | default `mxn` |
| `NIXPACKS_NODE_VERSION` | `22` |
| `PORT` | Railway lo inyecta |

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
