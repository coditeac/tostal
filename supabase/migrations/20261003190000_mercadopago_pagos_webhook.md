# Migración: Mercado Pago tracking + webhook

Aplicada vía Supabase MCP (`mercadopago_pagos_webhook`) en `yoxsldirdgdpsabsivac` (2026-10-03).

```sql
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS mp_preference_id text,
  ADD COLUMN IF NOT EXISTS mp_payment_id text;

ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS mp_preference_id text,
  ADD COLUMN IF NOT EXISTS mp_payment_id text;

CREATE TABLE IF NOT EXISTS public.mp_webhook_events (
  payment_id text PRIMARY KEY,
  topic text,
  external_reference text,
  status text,
  action text,
  payload jsonb,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mp_webhook_events_ext_ref_idx
  ON public.mp_webhook_events (external_reference);

ALTER TABLE public.mp_webhook_events ENABLE ROW LEVEL SECURITY;

INSERT INTO public.configuracion (clave, valor)
VALUES
  ('mp_activo', '1'),
  ('mp_moneda', 'MXN')
ON CONFLICT (clave) DO NOTHING;
```

Uso:

- `mp_preference_id` / `mp_payment_id` en pedido y reserva
- `mp_webhook_events` para idempotencia por `payment_id`
- Anticipo de reserva sigue en `productos.anticipo_tipo` / `anticipo_valor` (RPC `crear_reserva_publica`)
