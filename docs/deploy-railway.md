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
| **Restaurant** | https://app.tostal.cafe | https://app-tostal.up.railway.app |

Backend: **Supabase** (`yoxsldirdgdpsabsivac`). Nest `tostal-api` + Postgres Railway **ya teardown**.

### DNS (Namecheap) — acción manual pendiente

`api.tostal.cafe` aún puede resolver CNAME → Railway API borrada. **No editable desde este agent.**

En Namecheap, quitar:

| Host | Tipo | Acción |
|---|---|---|
| `api` | CNAME | **Borrar** (apuntaba a `*.up.railway.app`) |
| `_railway-verify.api` | TXT | **Borrar** si existe |

Dejar intactos `@`, `www`, `app`.

## Servicios Railway (activos)

| Service | Build / Start | Healthcheck |
|---|---|---|
| `tostal-cliente` | `apps/cliente` | `/` |
| `tostal-restaurant` | `apps/restaurant` | `/` |

Root Directory: monorepo `""` (incluye `shared/`).

**No redeployar** `tostal-api` (eliminado del monorepo: sin `apps/api`).

## Variables

### `tostal-cliente` / `tostal-restaurant`

| Variable | Notas |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` public |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo server (staff create, etc.) |
| `NIXPACKS_NODE_VERSION` | `22` |

Opcional residual a limpiar en Railway si aún existe: `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_TOSTAL_API_URL`.

### Email / Stripe (pendiente)

- Resend: re-cablear en Restaurant Route Handlers o Edge Function (P0). Vars: `RESEND_*`, `MAIL_MOCK`.
- Stripe: **UI deshabilitada**; no implementar Checkout en esta pasada.

## URLs

| App | URL |
|---|---|
| Cliente | https://tostal.cafe |
| Restaurant | https://app.tostal.cafe |

Dashboard Railway (proyecto cafe): ver store `docs/migracion-supabase.md`.  
Proyecto Railway viejo `6bca767c…`: **no tocar** sin confirmación.

## Realtime

Supabase Realtime en tablas `pedidos` + `reservas` (reemplaza SSE Nest).

## GitHub

Repo: https://github.com/coditeac/tostal — rama **`production`**.
