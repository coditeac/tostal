# Tostal — App Cliente

Superficie pública de **Tostal** (*Sabores que unen culturas*): menú por día, carrito, checkout y seguimiento de pedido.

Mobile first · UI en español · consume la API de App Restaurant.

## Arranque

Necesitas la **App Restaurant** (API) en `http://127.0.0.1:4321`.

```bash
cd apps/cliente
npm install
# .env.local ya apunta a la API:
# NEXT_PUBLIC_API_URL=http://127.0.0.1:4321
npm run dev
# → http://127.0.0.1:4322
```

Variables admitidas (en orden): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_TOSTAL_API_URL`.

## Flujo

1. Elige **día** de entrega/retiro (solo días abiertos con deadline vigente).
2. Ve el **menú del día** (productos activos ese día).
3. Arma el **carrito** → retiro o envío (zona + costo) → datos → pago.
4. **Pago:** transferencia (confirmación manual), contra entrega, o Stripe (mock si no hay `STRIPE_SECRET_KEY` en restaurant).
5. **Seguimiento** en `/pedido/[codigo]` o busca el código en `/seguimiento`.

Si pasó el deadline: no se puede pedir (“Ya cerramos pedidos para este día”).

## Rutas

| Ruta | Qué hace |
|---|---|
| `/` | Hero + selector de día + menú |
| `/carrito` | Carrito + checkout |
| `/pedido/[codigo]` | Seguimiento (auto-refresh) |
| `/seguimiento` | Buscar pedido por código |
