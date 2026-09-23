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

| Service | Root Directory | Healthcheck |
|---|---|---|
| `tostal-cliente` | `apps/cliente` | `/` |
| `tostal-restaurant` | `apps/restaurant` | `/api/public/dias` |

- Environments: **Staging**, **Production**
- Volumen en restaurant: mount `/data` → `TOSTAL_DB_PATH=/data/tostal.sqlite`
- Next escucha `0.0.0.0:$PORT` (`npm run start`)

## Variables de entorno

### `tostal-restaurant`

| Variable | Notas |
|---|---|
| `TOSTAL_AUTH_SECRET` | secreto fuerte (JWT) |
| `TOSTAL_CORS_ORIGINS` | URL(s) del cliente del mismo entorno |
| `TOSTAL_DB_PATH` | `/data/tostal.sqlite` |
| `STRIPE_SECRET_KEY` | opcional; sin clave = mock |

### `tostal-cliente`

| Variable | Notas |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL pública del restaurant |
| `NEXT_PUBLIC_TOSTAL_API_URL` | alias / fallback |

## URLs (dominios Railway generados)

| App | Staging | Production |
|---|---|---|
| Cliente | https://tostal-cliente-staging.up.railway.app | https://tostal-cliente-production-b06c.up.railway.app |
| Restaurant / API | https://tostal-restaurant-staging.up.railway.app | https://tostal-restaurant-production-566f.up.railway.app |

Dashboard: https://railway.app/project/6bca767c-9912-4c69-8879-6da93bbfb227

Los deploys arrancan cuando el repo GitHub tenga commits y los **deployment triggers** Staging←`main` / Production←`production` estén conectados.

## GitHub

Repo: https://github.com/coditeac/tostal

Código integrado (PRs #1+#3+#4) vive en Origin `main`/`production`; el push a GitHub requiere que el PAT del agent tenga **Contents: Write** (hoy solo `metadata=read`).
