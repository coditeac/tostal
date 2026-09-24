# Deploy Tostal en Railway (sin Vercel, sin GitHub Actions)

**Política Coditeac:** un solo entorno **Production**. Deploy con **integración Git nativa de Railway**. Cero staging. Cero `.github/workflows`. Cero Vercel.

> Nota: Railway marca `railway.toml` / `railway.json` como **deprecated** a favor de Infrastructure as Code (`.railway/railway.ts`). Los `apps/*/railway.toml` del repo documentan build/start; la config viva está en el dashboard/API.

## Modelo

| Entorno Railway | Branch Git | Redeploy |
|---|---|---|
| **Production** | `production` | Cada push a `production` |

Flujo: integrar en `main` si se usa como rama de trabajo, luego fast-forward / merge a `production` → Railway redeploya.

## Dominios

| App | Dominio oficial | Fallback temporal Railway |
|---|---|---|
| **Cliente** | https://tostal.cafe | https://tostal.up.railway.app |
| **Restaurant / API** | https://app.tostal.cafe | https://app-tostal.up.railway.app |

## Servicios (proyecto Railway **Tostal**)

| Service | Build / Start | Healthcheck |
|---|---|---|
| `tostal-cliente` | `npm --prefix apps/cliente ci && … build` / `… start` | `/` |
| `tostal-restaurant` | `npm --prefix apps/restaurant …` | `/api/public/dias` |
| `Postgres` | imagen oficial (visible en dashboard) | — |

- Root Directory: **monorepo** (`""`) para incluir `shared/`
- Un environment: **Production** ← branch `production`
- **Fuente de verdad de datos:** Postgres (`DATABASE_URL`)
- SQLite (`TOSTAL_DB_PATH`) solo como fallback **local** de desarrollo
- Node 22 (`NIXPACKS_NODE_VERSION` / `nixpacks.toml`)

## Variables de entorno

### `tostal-restaurant`

| Variable | Notas |
|---|---|
| `DATABASE_URL` | referencia `${{Postgres.DATABASE_URL}}` (red privada Railway) |
| `TOSTAL_AUTH_SECRET` | secreto fuerte (JWT) |
| `TOSTAL_CORS_ORIGINS` | `https://tostal.cafe,https://www.tostal.cafe,https://tostal.up.railway.app` |
| `STRIPE_SECRET_KEY` | opcional; sin clave = mock |
| `NIXPACKS_NODE_VERSION` | `22` |
| `TOSTAL_DB_PATH` | **opcional / legacy**; no usar en prod si hay `DATABASE_URL` |

### `tostal-cliente`

| Variable | Notas |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://app.tostal.cafe` (oficial) |
| `NEXT_PUBLIC_TOSTAL_API_URL` | mismo (alias / fallback) |
| `NIXPACKS_NODE_VERSION` | `22` |

### `Postgres`

Creado como servicio visible en el proyecto. Expone `DATABASE_URL` en red privada (`*.railway.internal`).

## URLs (Production)

| App | URL oficial |
|---|---|
| Cliente | https://tostal.cafe |
| Restaurant / API | https://app.tostal.cafe |

Dashboard: https://railway.app/project/6bca767c-9912-4c69-8879-6da93bbfb227

## Tiempo real (SSE)

- Público: `GET https://app.tostal.cafe/api/public/pedidos/events?codigo=T-…`
- Restaurant (cookie sesión): `GET https://app.tostal.cafe/api/pedidos/events?fecha=YYYY-MM-DD`

Ver `docs/arquitectura-datos-realtime.md` en el store del Project.

## GitHub

Repo: https://github.com/coditeac/tostal — deploy desde rama **`production`**.
