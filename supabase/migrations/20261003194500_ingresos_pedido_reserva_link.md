# Migración: ingresos ligados a pedido/reserva

Aplicada vía Supabase MCP (`ingresos_pedido_reserva_link`) en `yoxsldirdgdpsabsivac` (2026-10-03).

```sql
ALTER TABLE public.ingresos
  ADD COLUMN IF NOT EXISTS pedido_id uuid REFERENCES public.pedidos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reserva_id uuid REFERENCES public.reservas(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ingresos_pedido_id_uidx
  ON public.ingresos (pedido_id)
  WHERE pedido_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ingresos_reserva_id_uidx
  ON public.ingresos (reserva_id)
  WHERE reserva_id IS NOT NULL;

ALTER TABLE public.ingresos
  DROP CONSTRAINT IF EXISTS ingresos_origen_chk;

ALTER TABLE public.ingresos
  ADD CONSTRAINT ingresos_origen_chk
  CHECK (NOT (pedido_id IS NOT NULL AND reserva_id IS NOT NULL));
```

Uso:

- Al pasar un pedido o reserva a `entregado`, se inserta un ingreso `fuente=ventas` con ese `pedido_id` / `reserva_id`.
- El índice único parcial evita duplicados si el staff marca entregado más de una vez.
