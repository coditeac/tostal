# Tostal

**Tostal** — *Sabores que unen culturas*

| App | Carpeta | Puerto local | Rol |
|---|---|---|---|
| **API NestJS** | `apps/api` | **4331** | Única fuente de verdad: Postgres, auth, menú, pedidos, SSE, email |
| **Restaurant UI** | `apps/restaurant` | **4321** | Panel ops (solo consume la API) |
| **Cliente** | `apps/cliente` | **4322** | Menú, carrito, cuenta, seguimiento |

Base API: `http://127.0.0.1:4331` · Prod: `https://api.tostal.cafe`

---

## Arranque local

```bash
# 1) API (obligatorio)
cd apps/api && npm install && npm run start:dev
# → http://127.0.0.1:4331/health

# 2) Restaurant UI
cd apps/restaurant && npm install
NEXT_PUBLIC_API_URL=http://127.0.0.1:4331 npm run dev
# → http://127.0.0.1:4321

# 3) Cliente
cd apps/cliente && npm install
NEXT_PUBLIC_API_URL=http://127.0.0.1:4331 npm run dev
# → http://127.0.0.1:4322
```

### Superadmin (sin cuenta demo)

Define en el entorno de la API (local o Railway):

```bash
export SUPERADMIN_EMAIL="tu@email.com"
export SUPERADMIN_PASSWORD="elige-una-segura-8+"
# opcional: SUPERADMIN_NOMBRE="Coditeac"
# opcional (rotar): SUPERADMIN_FORCE_RESET=1
```

Al arrancar, si no existe superadmin, la API lo crea con ese email/password.  
**No hay** usuario `admin@tostal.mx` ni catálogo demo: el superadmin crea productos, categorías y staff a mano.

Sin `DATABASE_URL` la API usa SQLite en `./data` (o `TOSTAL_DB_PATH`). Con Postgres: exporta `DATABASE_URL`.

### Email (Resend)

- Con `RESEND_API_KEY` + `RESEND_FROM` (ej. `Tostal <pedidos@tostal.cafe>`) y `MAIL_MOCK=0` → envío real.
- Sin key o `MAIL_MOCK=1` → mock en consola (`[mail:mock]`) + fila en `email_log`.

Cliente: registro/login reales en `/cuenta` → `POST /api/cliente/register|login`.

---

## Contratos públicos

Prefijo `/api`. Errores: `{ "error": string }`.

- `GET /api/public/dias` · `GET /api/public/menu?fecha=`
- `POST /api/public/pedidos` (cuenta o guest+email)
- `GET /api/public/pedidos?codigo=` · SSE `/api/public/pedidos/events`
- Cliente: `/api/cliente/register|login|me|pedidos`
- Staff: `/api/auth/login`, `/api/usuarios` (admin/superadmin), módulos ops (`/api/pedidos`, `/api/caja`, …)

Tipos: `shared/types.ts` · contratos: `shared/api-public.ts`

---

## Deploy

Ver `docs/deploy-railway.md`. Branch de producción: `production`.

WhatsApp automático: **no** (cola manual). Estimación de costos en el store del Project: `docs/costos-whatsapp.md`.
