# Deploy Tostal en Railway (sin Vercel, sin GitHub Actions)

**Política Coditeac:** deploy solo con **integración Git nativa de Railway** (+ `railway.toml` / config as code). Cero `.github/workflows`. Cero Vercel.

## Modelo de ramas

| Entorno Railway | Branch Git | Cuándo redeploy |
|---|---|---|
| **Staging** | `main` | Cada push/merge a `main` |
| **Production** | `production` | Cada push a `production` (tras validar staging) |

Flujo: merge → `main` (staging) → cuando esté estable, fast-forward `production` desde `main` → production.

## Servicios (1 proyecto Railway, 2 services)

| Service | Root Directory | Puerto app | `railway.toml` |
|---|---|---|---|
| `tostal-cliente` | `apps/cliente` | Next escucha `0.0.0.0:$PORT` | `apps/cliente/railway.toml` |
| `tostal-restaurant` | `apps/restaurant` | idem + API pública | `apps/restaurant/railway.toml` |

Mismo repo Git; dos services con root distinto. En **cada** environment (Staging / Production) configuran el branch de source.

### Volumen (restaurant)

Montar volumen persistente en `/data` y definir:

```bash
TOSTAL_DB_PATH=/data/tostal.sqlite
```

Sin volumen, SQLite en el filesystem del contenedor se pierde en cada redeploy.

## Variables de entorno

### `tostal-restaurant`

| Variable | Staging / Production | Notas |
|---|---|---|
| `TOSTAL_AUTH_SECRET` | secreto fuerte | JWT cookie |
| `TOSTAL_CORS_ORIGINS` | URL(s) del cliente en ese entorno | CSV, sin espacios de más |
| `TOSTAL_DB_PATH` | `/data/tostal.sqlite` | requiere volumen |
| `STRIPE_SECRET_KEY` | opcional | sin clave = mock Stripe |
| `PORT` | lo setea Railway | no hace falta fijarlo |

### `tostal-cliente`

| Variable | Staging / Production | Notas |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL pública del restaurant | preferida |
| `NEXT_PUBLIC_TOSTAL_API_URL` | alias | fallback en código cliente |
| `PORT` | Railway | automático |

Tras el primer deploy de restaurant, copiar su dominio público a las vars del cliente (y CORS al revés).

## Setup (cuando haya auth Railway)

```bash
# Login (interactivo) o token
railway login
# o: export RAILWAY_TOKEN=…

# Crear proyecto + environments Staging / Production en dashboard
# Link repo GitHub coditeac/tostal
# Service Cliente: Root Directory apps/cliente · Watch paths según railway.toml
# Service Restaurant: Root Directory apps/restaurant · Volume /data
# Staging environment → branch main
# Production environment → branch production
```

CLI opcional (mismo proyecto):

```bash
cd apps/restaurant && railway link
cd ../cliente && railway link
```

No se usa `railway up` desde CI de GitHub; el redeploy lo dispara el webhook Git de Railway.

## URLs

| | Staging | Production |
|---|---|---|
| Cliente | *pendiente — dominio Railway tras link* | *pendiente* |
| Restaurant / API | *pendiente* | *pendiente* |

Plantilla esperada: `https://tostal-cliente-staging.up.railway.app`, etc. (Railway asigna al generar el service).

## Bloqueadores (VM agent)

1. **Railway:** CLI `Unauthorized. Please login with railway login`. No hay `RAILWAY_TOKEN` / `RAILWAY_API_TOKEN` en el environment → no se pudo `railway link` ni crear proyecto/services desde esta VM. Configs `railway.toml` quedan listas en el repo.
2. **GitHub:** PAT fine-grained `coditeac` → `403 Resource not accessible by personal access token` en `createRepository`. Repo `https://github.com/coditeac/tostal` aún no existe. Crear vacío a mano (o ampliar PAT) y conectar ese remote a Railway.
3. **Origin:** `main` y `production` ya contienen la integración PRs #1+#3+#4 (+ docs deploy) vía mirror git del agent.
