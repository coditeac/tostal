import { sqlAll, sqlGet, sqlRun, sqlTransaction } from "./db";
import { ensureSeed } from "./seed";
import { getConfigPublica } from "./config";
import { id } from "./utils";
import type {
  Categoria,
  DiaOperativo,
  Insumo,
  LineaReceta,
  MenuDiaResponse,
  Producto,
  ZonaEnvio,
} from "../../../../shared/types";

async function boot() {
  await ensureSeed();
}

/** Filas SQLite traen 0/1 donde el tipo de dominio usa boolean. */
type SqliteBool<T, K extends keyof T> = Omit<T, K> & { [P in K]: number };

export async function listCategorias(): Promise<Categoria[]> {
  await boot();
  const rows = await sqlAll<{
    id: string;
    nombre: string;
    orden: number;
    activa: number;
  }>(`SELECT id, nombre, orden, activa FROM categorias ORDER BY orden, nombre`);
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    orden: r.orden,
    activa: !!r.activa,
  }));
}

export async function listProductos(): Promise<
  Array<Producto & { categoriaNombre: string | null }>
> {
  await boot();
  const rows = await sqlAll<
    SqliteBool<Producto, "activoCatalogo"> & { categoriaNombre: string | null }
  >(
    `SELECT p.id, p.categoria_id as categoriaId, p.nombre, p.descripcion,
            p.precio, p.activo_catalogo as activoCatalogo, p.foto_url as fotoUrl,
            p.alergenos, p.orden, c.nombre as categoriaNombre
     FROM productos p
     LEFT JOIN categorias c ON c.id = p.categoria_id
     ORDER BY p.orden, p.nombre`
  );
  return rows.map((r) => ({
    ...r,
    activoCatalogo: !!r.activoCatalogo,
  }));
}

export async function getProducto(idProd: string): Promise<Producto | null> {
  await boot();
  const r = await sqlGet<SqliteBool<Producto, "activoCatalogo">>(
    `SELECT id, categoria_id as categoriaId, nombre, descripcion, precio,
            activo_catalogo as activoCatalogo, foto_url as fotoUrl, alergenos, orden
     FROM productos WHERE id = ?`,
    idProd
  );
  if (!r) return null;
  return { ...r, activoCatalogo: !!r.activoCatalogo };
}

export async function upsertProducto(data: {
  id?: string;
  categoriaId: string | null;
  nombre: string;
  descripcion: string | null;
  precio: number;
  activoCatalogo: boolean;
  alergenos: string | null;
  orden?: number;
}): Promise<Producto> {
  await boot();
  const pid = data.id || id();
  if (data.id) {
    await sqlRun(
      `UPDATE productos SET categoria_id=?, nombre=?, descripcion=?, precio=?,
       activo_catalogo=?, alergenos=?, orden=? WHERE id=?`,
      data.categoriaId,
      data.nombre,
      data.descripcion,
      data.precio,
      data.activoCatalogo ? 1 : 0,
      data.alergenos,
      data.orden ?? 0,
      pid
    );
  } else {
    await sqlRun(
      `INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, activo_catalogo, foto_url, alergenos, orden)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
      pid,
      data.categoriaId,
      data.nombre,
      data.descripcion,
      data.precio,
      data.activoCatalogo ? 1 : 0,
      data.alergenos,
      data.orden ?? 0
    );
  }
  return (await getProducto(pid))!;
}

export async function listInsumos(): Promise<Insumo[]> {
  await boot();
  return sqlAll<Insumo>(
    `SELECT id, nombre, unidad, stock_actual as stockActual, stock_minimo as stockMinimo,
            costo_unitario as costoUnitario, ubicacion, proveedor_preferido as proveedorPreferido
     FROM insumos ORDER BY nombre`
  );
}

export async function upsertInsumo(data: {
  id?: string;
  nombre: string;
  unidad: Insumo["unidad"];
  stockActual: number;
  stockMinimo: number;
  costoUnitario: number;
  ubicacion: string | null;
  proveedorPreferido: string | null;
}): Promise<Insumo> {
  await boot();
  const iid = data.id || id();
  if (data.id) {
    await sqlRun(
      `UPDATE insumos SET nombre=?, unidad=?, stock_actual=?, stock_minimo=?,
       costo_unitario=?, ubicacion=?, proveedor_preferido=? WHERE id=?`,
      data.nombre,
      data.unidad,
      data.stockActual,
      data.stockMinimo,
      data.costoUnitario,
      data.ubicacion,
      data.proveedorPreferido,
      iid
    );
  } else {
    await sqlRun(
      `INSERT INTO insumos (id, nombre, unidad, stock_actual, stock_minimo, costo_unitario, ubicacion, proveedor_preferido)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      iid,
      data.nombre,
      data.unidad,
      data.stockActual,
      data.stockMinimo,
      data.costoUnitario,
      data.ubicacion,
      data.proveedorPreferido
    );
  }
  return (await listInsumos()).find((i) => i.id === iid)!;
}

export async function getReceta(productoId: string): Promise<LineaReceta[]> {
  await boot();
  return sqlAll<LineaReceta>(
    `SELECT r.id, r.producto_id as productoId, r.insumo_id as insumoId, r.cantidad,
            i.nombre as insumoNombre, i.unidad
     FROM receta_lineas r
     JOIN insumos i ON i.id = r.insumo_id
     WHERE r.producto_id = ?
     ORDER BY i.nombre`,
    productoId
  );
}

export async function setReceta(
  productoId: string,
  lineas: Array<{ insumoId: string; cantidad: number }>
) {
  await boot();
  await sqlTransaction(async () => {
    await sqlRun(`DELETE FROM receta_lineas WHERE producto_id = ?`, productoId);
    for (const l of lineas) {
      if (l.cantidad <= 0) continue;
      await sqlRun(
        `INSERT INTO receta_lineas (id, producto_id, insumo_id, cantidad) VALUES (?, ?, ?, ?)`,
        id(),
        productoId,
        l.insumoId,
        l.cantidad
      );
    }
  });
  return getReceta(productoId);
}

export async function costoTeoricoProducto(productoId: string): Promise<number> {
  const lineas = await getReceta(productoId);
  const insumos = Object.fromEntries(
    (await listInsumos()).map((i) => [i.id, i])
  );
  return lineas.reduce((acc, l) => {
    const i = insumos[l.insumoId];
    if (!i) return acc;
    return acc + Math.round(l.cantidad * i.costoUnitario);
  }, 0);
}

export async function listDias(
  from: string,
  to: string
): Promise<DiaOperativo[]> {
  await boot();
  const rows = await sqlAll<SqliteBool<DiaOperativo, "abierto">>(
    `SELECT id, fecha, abierto, deadline_pedido as deadlinePedido,
            cupo_maximo as cupoMaximo, notas
     FROM dias_operativos
     WHERE fecha >= ? AND fecha <= ?
     ORDER BY fecha`,
    from,
    to
  );
  return rows.map((d) => ({ ...d, abierto: !!d.abierto }));
}

export async function getDia(fecha: string): Promise<DiaOperativo | null> {
  await boot();
  const d = await sqlGet<SqliteBool<DiaOperativo, "abierto">>(
    `SELECT id, fecha, abierto, deadline_pedido as deadlinePedido,
            cupo_maximo as cupoMaximo, notas
     FROM dias_operativos WHERE fecha = ?`,
    fecha
  );
  if (!d) return null;
  return { ...d, abierto: !!d.abierto };
}

export async function upsertDia(data: {
  fecha: string;
  abierto: boolean;
  deadlinePedido: string;
  cupoMaximo: number | null;
  notas: string | null;
}): Promise<DiaOperativo> {
  await boot();
  const existing = await getDia(data.fecha);
  if (existing) {
    await sqlRun(
      `UPDATE dias_operativos SET abierto=?, deadline_pedido=?, cupo_maximo=?, notas=? WHERE fecha=?`,
      data.abierto ? 1 : 0,
      data.deadlinePedido,
      data.cupoMaximo,
      data.notas,
      data.fecha
    );
  } else {
    await sqlRun(
      `INSERT INTO dias_operativos (id, fecha, abierto, deadline_pedido, cupo_maximo, notas)
       VALUES (?, ?, ?, ?, ?, ?)`,
      id(),
      data.fecha,
      data.abierto ? 1 : 0,
      data.deadlinePedido,
      data.cupoMaximo,
      data.notas
    );
  }
  return (await getDia(data.fecha))!;
}

export async function getDisponibilidad(fecha: string): Promise<
  Array<{
    productoId: string;
    disponible: boolean;
    productoNombre: string;
  }>
> {
  await boot();
  const rows = await sqlAll<{
    productoId: string;
    disponible: number;
    productoNombre: string;
  }>(
    `SELECT d.producto_id as productoId, d.disponible, p.nombre as productoNombre
     FROM disponibilidad_producto_dia d
     JOIN productos p ON p.id = d.producto_id
     WHERE d.fecha = ?
     ORDER BY p.orden, p.nombre`,
    fecha
  );

  if (rows.length === 0) {
    // Si no hay filas, devolver todos los productos del catálogo como no configurados
    return (await listProductos()).map((p) => ({
      productoId: p.id,
      disponible: false,
      productoNombre: p.nombre,
    }));
  }
  return rows.map((r) => ({
    productoId: r.productoId,
    disponible: !!r.disponible,
    productoNombre: r.productoNombre,
  }));
}

export async function setDisponibilidad(
  fecha: string,
  items: Array<{ productoId: string; disponible: boolean }>
) {
  await boot();
  await sqlTransaction(async () => {
    for (const it of items) {
      await sqlRun(
        `INSERT INTO disponibilidad_producto_dia (id, fecha, producto_id, disponible)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(fecha, producto_id) DO UPDATE SET disponible = excluded.disponible`,
        id(),
        fecha,
        it.productoId,
        it.disponible ? 1 : 0
      );
    }
  });
  return getDisponibilidad(fecha);
}

export async function copiarDisponibilidad(desde: string, hacia: string) {
  const items = (await getDisponibilidad(desde)).map((i) => ({
    productoId: i.productoId,
    disponible: i.disponible,
  }));
  return setDisponibilidad(hacia, items);
}

export async function listZonas(): Promise<ZonaEnvio[]> {
  await boot();
  const rows = await sqlAll<SqliteBool<ZonaEnvio, "activa">>(
    `SELECT id, nombre, cobertura, costo_envio as costoEnvio, activa
     FROM zonas_envio ORDER BY nombre`
  );
  return rows.map((z) => ({ ...z, activa: !!z.activa }));
}

export async function getMenuPorDia(fecha: string): Promise<MenuDiaResponse> {
  await boot();
  const dia = await getDia(fecha);
  const config = await getConfigPublica();
  const categorias = (await listCategorias()).filter((c) => c.activa);
  const zonas = (await listZonas()).filter((z) => z.activa);
  const disp = Object.fromEntries(
    (await getDisponibilidad(fecha)).map((d) => [d.productoId, d.disponible])
  );
  const productos = (await listProductos())
    .filter((p) => p.activoCatalogo)
    .map((p) => ({
      ...p,
      disponible: !!disp[p.id],
      categoriaNombre: p.categoriaNombre,
    }))
    .filter((p) => p.disponible);

  const deadline = dia?.deadlinePedido || `${fecha}T00:00:00.000Z`;
  const deadlineVigente = new Date() < new Date(deadline);
  const abierto = dia ? dia.abierto && deadlineVigente : false;

  return {
    fecha,
    abierto,
    deadlinePedido: deadline,
    deadlineVigente,
    cupoMaximo: dia?.cupoMaximo ?? null,
    productos,
    categorias,
    zonas,
    config,
  };
}
