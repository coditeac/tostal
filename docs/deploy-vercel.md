# Deploy Tostal (Vercel Git — sin GitHub Actions)

**Política Coditeac:** no hay CI en `.github/workflows`. El deploy lo hace **solo la integración nativa Vercel ↔ Git**.

## Modelo de ramas

| Entorno | Branch Git | Cómo lo trata Vercel |
|---|---|---|
| **Staging** | `main` | Preview / branch `main` (no Production) |
| **Production** | `production` | Production Branch de cada proyecto |

Flujo operativo:

1. Merge a `main` → Vercel redeploya **staging** (ambos proyectos).
2. Cuando staging esté estable → actualizar rama `production` (fast-forward desde `main`) → Vercel redeploya **production**.

No usar GitHub Actions ni `vercel deploy` desde Actions.

## Proyectos Vercel (2, monorepo)

| Proyecto sugerido | Root Directory | Framework |
|---|---|---|
| `tostal-cliente` | `apps/cliente` | Next.js (`vercel.json` incluido) |
| `tostal-restaurant` | `apps/restaurant` | Next.js (`vercel.json` incluido) |

## Setup (dashboard / CLI, una vez)

Requiere cuenta Vercel logueada (`vercel login` o Import from Git en vercel.com).

1. **Importar** el repo GitHub `coditeac/tostal` (o conectar el Git remote que use el equipo).
2. Crear **dos** projects apuntando al mismo repo, con Root Directory distinto (`apps/cliente` / `apps/restaurant`).
3. En **cada** project → Settings → Git:
   - Production Branch = **`production`**
   - Deployments de `main` = staging / preview (no marcar `main` como Production Branch)
4. Env vars por environment (Preview = staging desde `main`; Production = rama `production`):

   **cliente**
   - `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_TOSTAL_API_URL` → URL del restaurant en ese entorno

   **restaurant**
   - `TOSTAL_AUTH_SECRET`
   - `TOSTAL_CORS_ORIGINS` → URL(s) del cliente
   - `TOSTAL_DB_PATH` (ver nota SQLite)
   - `STRIPE_SECRET_KEY` (opcional; sin clave = mock)

5. Opcional CLI (mismo resultado que el dashboard):

```bash
cd apps/cliente && vercel link --yes --project tostal-cliente
cd ../restaurant && vercel link --yes --project tostal-restaurant
# En dashboard: Production Branch = production; Root Directory ya quedó al linkear
```

## Nota SQLite en Vercel

`apps/restaurant` usa **better-sqlite3**. En serverless el disco es efímero (`/tmp`): la DB **no persiste** entre cold starts. Útil para demos staging; production real necesita Turso/libSQL, Postgres u host con disco persistente.

## Bloqueadores (VM agent)

1. **GitHub:** PAT fine-grained de `coditeac` → `403` en `createRepository`. No se pudo crear `https://github.com/coditeac/tostal`. Crear el repo vacío (o ampliar PAT) y pushear `main` + `production`.
2. **Vercel:** CLI `Logged out`, sin `VERCEL_TOKEN`. No se pudo `vercel link` ni conectar el Git integration desde esta VM. Un deploy anónimo temporal de **cliente** sí corrió (~60 min de vida).
