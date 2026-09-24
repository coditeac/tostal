# Deploy Tostal en Railway (sin Vercel, sin GitHub Actions)

**Política Coditeac:** un solo entorno **Production**. Deploy con **integración Git nativa de Railway**. Cero staging. Cero `.github/workflows`. Cero Vercel.

> Nota: Railway marca `railway.toml` / `railway.json` como **deprecated** a favor de Infrastructure as Code (`.railway/railway.ts`). Los `apps/*/railway.toml` del repo documentan build/start; la config viva está en el dashboard/API.

## Modelo

| Entorno Railway | Branch Git | Redeploy |
|---|---|---|
| **Production** | `production` | Cada push a `production` |

Flujo: integrar en `main` si se usa como rama de trabajo, luego fast-forward / merge a `production` → Railway redeploya.

## Servicios (proyecto Railway **Tostal**)

| Service | Build / Start | Healthcheck |
|---|---|---|
| `tostal-cliente` | `npm --prefix apps/cliente ci && … build` / `… start` | `/` |
| `tostal-restaurant` | `npm --prefix apps/restaurant …` | `/api/public/dias` |

- Root Directory: **monorepo** (`""`) para incluir `shared/`
- Un environment: **Production** ← branch `production`
- Volumen restaurant: `/data` → `TOSTAL_DB_PATH=/data/tostal.sqlite`
- Node 22 (`NIXPACKS_NODE_VERSION` / `nixpacks.toml`)

## Variables de entorno

### `tostal-restaurant`

| Variable | Notas |
|---|---|
| `TOSTAL_AUTH_SECRET` | secreto fuerte (JWT) |
| `TOSTAL_CORS_ORIGINS` | URL del cliente production |
| `TOSTAL_DB_PATH` | `/data/tostal.sqlite` |
| `STRIPE_SECRET_KEY` | opcional; sin clave = mock |
| `NIXPACKS_NODE_VERSION` | `22` |

### `tostal-cliente`

| Variable | Notas |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL pública del restaurant |
| `NEXT_PUBLIC_TOSTAL_API_URL` | alias / fallback |
| `NIXPACKS_NODE_VERSION` | `22` |

## URLs (Production)

| App | URL |
|---|---|
| Cliente | https://tostal-cliente-production.up.railway.app |
| Restaurant / API | https://tostal-restaurant-production.up.railway.app |

Dashboard: https://railway.app/project/6bca767c-9912-4c69-8879-6da93bbfb227

## GitHub

Repo: https://github.com/coditeac/tostal — deploy desde rama **`production`**.
