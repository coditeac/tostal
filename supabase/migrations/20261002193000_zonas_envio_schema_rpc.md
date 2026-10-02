-- Applied via Supabase MCP apply_migration: zonas_envio_schema_rpc
-- Project: yoxsldirdgdpsabsivac (2026-10-02)
-- P1 solapes: zonas de envío reales + costo server-side

-- Tabla public.zonas_envio (id, nombre, cobertura, costo_envio centavos, activa, orden)
-- pedidos.zona_id FK → zonas_envio
-- RLS: staff ALL (is_staff); anon/authenticated SELECT activa=true
-- RPCs:
--   list_zonas_activas()
--   calcular_costo_envio(p_zona_id uuid)
--   get_menu_hoy() → zonas activas (costoEnvio)
--   crear_pedido_publico() → valida zona+dirección si envio; costo_envio desde tabla (ignora cliente)

-- Full SQL applied remotely via MCP; this file is the audit trail for the monorepo.
