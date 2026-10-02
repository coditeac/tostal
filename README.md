# Tostal

**Tostal** — *Sabores que unen culturas*

| App | Carpeta | Puerto local | Rol |
|---|---|---|---|
| **Restaurant** | `apps/restaurant` | **4321** | Panel ops + Route Handlers (`/api/staff`, …) |
| **Cliente** | `apps/cliente` | **4322** | Menú, carrito, cuenta, seguimiento, reservas |

Backend: **Supabase** (Auth, Postgres, Storage `productos`, Realtime). No hay Nest / `apps/api`.

URLs prod: Cliente https://tostal.cafe · Restaurant https://app.tostal.cafe

---

## Arranque local

```bash
# 1) Restaurant
cd apps/restaurant && npm install
# NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY (+ SUPABASE_SERVICE_ROLE_KEY server)
npm run dev
# → http://127.0.0.1:4321

# 2) Cliente
cd apps/cliente && npm install
# mismas vars públicas Supabase
npm run dev
# → http://127.0.0.1:4322
```

### Auth / roles

Roles en `profiles.rol`: `superadmin` \| `admin` \| `cocina` \| `caja` \| `cliente`.  
Staff se gestiona en Restaurant → Ajustes → Personal (`POST /api/staff` con service role).

### Config de negocio

Tabla Supabase `configuracion` (key-value): marca, teléfono WhatsApp, dirección de retiro, hora límite default, mensaje WA, etc. Panel: Ajustes → Config.

### Fotos de producto

Upload cableado a Storage bucket `productos` → columna `productos.imagen_url`. Sin foto = placeholder en Cliente (no hay imágenes demo inventadas).

### Pagos

Transferencia y contra entrega activos. **Stripe deshabilitado** en UI hasta Edge Function / Checkout.

### Email (Resend) — post Supabase

Vars en Railway **tostal-restaurant** y **tostal-cliente** (no en Nest):

```bash
RESEND_API_KEY=           # key del dashboard Resend
RESEND_FROM=Tostal <pedidos@tostal.cafe>
MAIL_MOCK=1               # 1 o sin key → mock + email_log; 0 + key → envío real
STAFF_NOTIFY_EMAIL=       # opcional CSV para aviso de pedidos/reservas nuevos
SUPABASE_SERVICE_ROLE_KEY=# ya usada en restaurant; también en cliente para email_log
```

Eventos: pedido/reserva creados (confirmación cliente) y cambio de estado desde Restaurant.

---

## Deploy

Ver `docs/deploy-railway.md`. Branch de producción: `production`.

WhatsApp automático: **no** (cola manual). Estimación de costos en el store del Project: `docs/costos-whatsapp.md`.
