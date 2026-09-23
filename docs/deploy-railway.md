# Deploy Tostal en Railway (sin Vercel, sin GitHub Actions)

**Política Coditeac:** deploy solo con **integración Git nativa de Railway**. Cero `.github/workflows`. Cero Vercel.

> Nota: Railway marca `railway.toml` / `railway.json` como **deprecated** a favor de Infrastructure as Code (`.railway/railway.ts`). Los `apps/*/railway.toml` del repo documentan root/build/start; la config viva del proyecto **Tostal** está en el dashboard/API (root directories, healthchecks, volúmenes, vars).

## Modelo de ramas

| Entorno Railway | Branch Git | Cuándo redeploy |
|---|---|---|
| **Staging** | `main` | Cada push/merge a `main` |
| **Production** | `production` | Cada push a `production` (tras validar staging) |

Flujo: merge → `main` (staging) → cuando esté estable, fast-forward `production` desde `main` → production.

## Servicios (proyecto Railway **Tostal**)

| Service | Build / Start | Healthcheck |
|---|---|---|
| `tostal-cliente` | `npm --prefix apps/cliente ci && … build` / `… start` | `/` |
| `tostal-restaurant` | `npm --prefix apps/restaurant …` | `/api/public/dias` |

- Root Directory del service: **monorepo** (`""`) para incluir `shared/`
- Environments: **Staging** ← branch `main` · **Production** ← branch `production`
- Volumen restaurant: `/data` → `TOSTAL_DB_PATH=/data/tostal.sqlite`
- Node 22 (`NIXPACKS_NODE_VERSION` / `nixpacks.toml`)

## Variables de entorno

### `tostal-restaurant`

| Variable | Notas |
|---|---|
| `TOSTAL_AUTH_SECRET` | secreto fuerte (JWT) |
| `TOSTAL_CORS_ORIGINS` | URL(s) del cliente del mismo entorno |
| `TOSTAL_DB_PATH` | `/data/tostal.sqlite` |
| `STRIPE_SECRET_KEY` | opcional; sin clave = mock |
| `NIXPACKS_NODE_VERSION` | `22` |

### `tostal-cliente`

| Variable | Notas |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL pública del restaurant |
| `NEXT_PUBLIC_TOSTAL_API_URL` | alias / fallback |
| `NIXPACKS_NODE_VERSION` | `22` |

## URLs

| App | Staging | Production |
|---|---|---|
| Cliente | https://tostal-cliente-staging.up.railway.app | https://tostal-cliente-production-b06c.up.railway.app |
| Restaurant / API | https://tostal-restaurant-staging.up.railway.app | https://tostal-restaurant-production-566f.up.railway.app |

Dashboard: https://railway.app/project/6bca767c-9912-4c69-8879-6da93bbfb227

## GitHub

Repo: https://github.com/coditeac/tostal — ramas `main` y `production` (mismo tip).
