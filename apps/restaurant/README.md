# Tostal Restaurant (ops)

Panel staff en **https://app.tostal.cafe** — 6 módulos + ajustes.  
Backend: **Supabase** (Auth + Postgres + Storage `productos` + Realtime). Sin NestJS.

## Stack

- Next.js 16 · React 19 · Tailwind · shadcn/ui
- `@supabase/ssr` + `@supabase/supabase-js`
- Roles vía **`profiles.rol`**: `superadmin` | `admin` | `cocina` | `caja`

## Superadmin

Email confirmado Coditeac: **`cocina@tostal.cafe`** (`profiles.rol = superadmin`).

## Env

```bash
cp .env.example .env.local
```

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://yoxsldirdgdpsabsivac.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable |
| `SUPABASE_SERVICE_ROLE_KEY` | solo server (alta staff avanzada / invite) |

## Local

```bash
npm install
npm run dev   # http://127.0.0.1:4321
```

## Módulos

Productos · Almacén · Compras · Finanzas · Pedidos · Reservaciones (+ Ajustes).
