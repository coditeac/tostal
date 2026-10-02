-- Applied via Supabase MCP apply_migration: security_p0_p1_hardening
-- Project: yoxsldirdgdpsabsivac (2026-10-02)
-- See docs/auditoria-seguridad.md

-- Privilege escalation fix + RLS IDOR + recipe leak + clamp shipping
-- (full SQL already applied remotely; this file is the audit trail)

-- handle_new_user always sets rol = 'cliente' (ignores signup metadata)
-- DROP client INSERT policies on pedidos/reservas/items
-- producto_insumos no longer public-readable
-- productos public SELECT only activo = true
-- menu_dia public SELECT only hoy abierto
-- search_path fixed on hoy_cdmx / deadline_cdmx / gen_*_codigo
-- crear_pedido_publico ignores client costoEnvio (sets 0)
-- profiles INSERT cannot self-assign staff roles
