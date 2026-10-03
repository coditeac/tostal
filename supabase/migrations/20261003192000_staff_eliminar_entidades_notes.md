# Migración: staff_eliminar_entidades_notes

Aplicada vía Supabase MCP en `yoxsldirdgdpsabsivac`.

## Contenido

Comentarios de columna (documentación) sobre soft-delete:

- `productos.activo`
- `insumos.activo`
- `zonas_envio.activa`
- `profiles.activo`

Sin cambios de RLS: staff (`is_staff()`) ya tiene `ALL` en tablas de negocio; cliente nunca borra.

## Comportamiento en app Restaurant

| Entidad | Comportamiento |
|---|---|
| Productos | Soft: `activo=false` + menú día off |
| Insumos | Hard si sin uso; soft si receta/compra |
| Pedidos / Reservas | Anular → `estado=cancelado` (fuera de cola) |
| Compras | `estado=anulada` (no revierte stock/gasto) |
| Zonas | Hard; fallback `activa=false` si FK |
| Gastos / Ingresos | Hard delete |
| Staff | Soft `activo=false`; bloquea único superadmin |
