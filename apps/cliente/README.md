# Tostal — App Cliente

Superficie pública de **Tostal** (*Sabores que unen culturas*): menú del día, carrito, reservas, seguimiento.

Mobile first · UI en español · **Supabase** (auth, Postgres, Storage, Realtime). Sin Nest / sin `NEXT_PUBLIC_API_URL`.

## Arranque

```bash
cd apps/cliente
npm install
# .env.local:
# NEXT_PUBLIC_SUPABASE_URL=https://yoxsldirdgdpsabsivac.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>
npm run dev
# → http://127.0.0.1:4322
```

Railway `tostal-cliente` ya lleva esas vars.

## Roles

- Compradores: `profiles.rol = cliente` (default al signup).
- Staff/superadmin (`cocina@tostal.cafe`, etc.): **app.tostal.cafe** — esta app no deja entrar cuentas staff.

## Flujo

1. **Menú de hoy** (CDMX) desde `menu_dia` + `productos.imagen_url` (Storage `productos`).
2. Carrito → pedido (`crear_pedido_publico`) con hora límite.
3. **Pago:** transferencia, contra entrega o **Mercado Pago** (Checkout Pro). Sin `MP_ACCESS_TOKEN` el pago con tarjeta se simula.
4. **Reservas** (`list_reservas_productos` / `crear_reserva_publica`) con anticipo (MP o transferencia).
5. Seguimiento `/pedido/[codigo]` y `/reserva/[codigo]` vía RPC + Realtime (polling fallback).
6. Webhook MP: `/api/webhooks/mercadopago` → actualiza `estado_pago` / `estado_anticipo`.
7. Cuenta opcional: Auth email/password Supabase.

## Rutas

| Ruta | Qué hace |
|---|---|
| `/` | Menú de hoy (UI Rappi) |
| `/carrito` | Checkout pedido del día |
| `/reservas` | Reservas bajo pedido |
| `/pedido/[codigo]` | Seguimiento pedido |
| `/reserva/[codigo]` | Seguimiento reserva |
| `/seguimiento` | Buscar por código |
| `/cuenta` | Login / registro cliente |
