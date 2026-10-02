-- Applied via Supabase MCP apply_migration: configuracion_kv
-- Project: yoxsldirdgdpsabsivac (2026-10-02)
-- P2 cleanup: key-value business config (Nest `configuracion` parity)

-- CREATE TABLE public.configuracion (clave PK, valor, updated_at)
-- RLS: staff ALL; anon/auth SELECT on public business keys
-- Seed: marca, eslogan, moneda, canales, telefono_whatsapp, direccion_retiro,
--       hora_limite_default, mensaje_whatsapp, checkout_*
