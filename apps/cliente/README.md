# Tostal — App Cliente

Superficie pública de **Tostal** (*Sabores que unen culturas*): menú por día, carrito, checkout y seguimiento de pedido.

Mobile first · UI en español · consume la **API NestJS** (`apps/api`).

## Arranque

Necesitas la API NestJS en `http://127.0.0.1:4331` (u otra URL vía env).

```bash
# Terminal 1 — API
cd apps/api && npm install && npm run start:dev

# Terminal 2 — Cliente
cd apps/cliente
npm install
# .env.local:
# NEXT_PUBLIC_API_URL=http://127.0.0.1:4331
npm run dev
# → http://127.0.0.1:4322
```

Variables admitidas (en orden): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_TOSTAL_API_URL`.

## Flujo

1. Elige **día** de entrega/retiro (solo días abiertos con deadline vigente).
2. Ve el **menú del día** (productos activos ese día).
3. Arma el **carrito** → retiro o envío (zona + costo) → datos → pago.
4. **Pago:**
   - transferencia (confirmación manual en ops),
   - contra entrega,
   - Stripe (Checkout `price_data` / PaymentIntent; **mock** si la API no tiene `STRIPE_SECRET_KEY`).
5. **Seguimiento** en `/pedido/[codigo]` o busca el código en `/seguimiento`.

Si pasó el deadline: no se puede pedir (“Ya cerramos pedidos para este día”).

## Rutas

| Ruta | Qué hace |
|---|---|
| `/` | Hero + selector de día + menú |
| `/carrito` | Carrito + checkout |
| `/pedido/[codigo]` | Seguimiento (SSE) + pagar Stripe si pendiente |
| `/seguimiento` | Buscar pedido por código |
| `/cuenta` | Registro / login cliente (opcional) |
