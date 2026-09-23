# Tostal

**Tostal** — *Sabores que unen culturas*

Dos apps web mobile first para la cafetería de postres Tostal:

1. **App Cliente** (`apps/cliente`) — menú por día, carrito, pagos y seguimiento
2. **App Restaurant** (`apps/restaurant`) — admin / cocina / caja + API/núcleo

## Requisitos

- Node.js 20+
- npm

## Arranque local

```bash
# Terminal 1 — API + operación (puerto 4321)
cd apps/restaurant
npm install
npm run dev

# Terminal 2 — app pública del cliente (puerto 4322)
cd apps/cliente
npm install
# opcional: export NEXT_PUBLIC_TOSTAL_API_URL=http://127.0.0.1:4321
npm run dev
```

- Restaurant: [http://127.0.0.1:4321](http://127.0.0.1:4321)
- Cliente: [http://127.0.0.1:4322](http://127.0.0.1:4322)

### Credenciales demo (Restaurant)

- Email: `admin@tostal.mx`
- Contraseña: `tostal123`

La base SQLite se crea sola en `apps/restaurant/data/tostal.sqlite` con menú, insumos, recetas, calendario (14 días) y zonas de envío de ejemplo.

## Variables de entorno

### App Restaurant (`apps/restaurant/.env.local`)

```bash
TOSTAL_AUTH_SECRET=cambia-esto-en-produccion
TOSTAL_CORS_ORIGINS=http://127.0.0.1:4322,http://localhost:4322
# Opcional: ruta de la DB
# TOSTAL_DB_PATH=./data/tostal.sqlite

# Stripe (opcional). Sin clave → modo mock: pedidos Stripe quedan "pagado".
# STRIPE_SECRET_KEY=sk_test_...
```

### App Cliente (`apps/cliente/.env.local`)

```bash
NEXT_PUBLIC_TOSTAL_API_URL=http://127.0.0.1:4321
```

## Qué incluye este slice

- Scaffold de ambas apps Next.js (TypeScript, Tailwind)
- Identidad Tostal en UI (marca + eslogan)
- Persistencia SQLite real
- Auth admin App Restaurant
- CRUD productos, insumos y recetas + costo/margen teórico
- Canales remoto / mostrador en configuración
- Calendario: disponibilidad por día + deadline + cupo
- App Cliente: elegir día → menú filtrado → carrito → checkout (transferencia / contra entrega / Stripe mock) → seguimiento
- Cola de avisos WhatsApp manuales (copiar / abrir / marcar enviado)
- Pedidos restaurant: cambio de estado; al pasar a *en producción* se descuentan insumos

## Pendiente del plan completo

Compras sugeridas, gastos/reportes avanzados, caja/mostrador con ficha, vitrina, Stripe real con Checkout Sessions, variantes/extras de producto, roles cocina/caja con UI dedicada, PWA.

## Estructura

```
apps/cliente      # frontend cliente
apps/restaurant   # frontend operación + API + SQLite
shared/types.ts   # tipos compartidos
```
