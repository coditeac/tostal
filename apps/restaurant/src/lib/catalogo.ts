import { getDb } from "./db";
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

function boot() {
  ensureSeed();
}

/** Filas SQLite traen 0/1 donde el tipo de dominio usa boolean. */
type SqliteBool<T, K extends keyof T> = Omit<T, K> & { [P in K]: number };

export function listCategorias(): Categoria[] {
  boot();
  return (
    getDb()
      .prepare(
        `SELECT id, nombre, orden, activa FROM categorias ORDER BY orden, nombre`
      )
      .all() as Array<{
      id: string;
      nombre: string;
      orden: number;
      activa: number;
    }>
  ).map((r) => ({
    id: r.id,
    nombre: r.nombre,
    orden: r.orden,
    activa: !!r.activa,
  }));
}

export function listProductos(): Array<
  Producto & { categoriaNombre: string | null }
> {
  boot();
  return (
    getDb()
      .prepare(
        `SELECT p.id, p.categoria_id as categoriaId, p.nombre, p.descripcion,
                p.precio, p.activo_catalogo as activoCatalogo, p.foto_url as fotoUrl,
                p.alergenos, p.orden, c.nombre as categoriaNombre
         FROM productos p
         LEFT JOIN categorias c ON c.id = p.categoria_id
         ORDER BY p.orden, p.nombre`
      )
      .all() as Array<
        SqliteBool<Producto, "activoCatalogo"> & { categoriaNombre: string | null }
      >
  ).map((r) => ({
    ...r,
    activoCatalogo: !!r.activoCatalogo,
  }));
}

export function getProducto(idProd: string): Producto | null {
  boot();
  const r = getDb()
    .prepare(
      `SELECT id, categoria_id as categoriaId, nombre, descripcion, precio,
              activo_catalogo as activoCatalogo, foto_url as fotoUrl, alergenos, orden
       FROM productos WHERE id = ?`
    )
    .get(idProd) as SqliteBool<Producto, "activoCatalogo"> | undefined;
  if (!r) return null;
  return { ...r, activoCatalogo: !!r.activoCatalogo };
}

export function upsertProducto(data: {
  id?: string;
  categoriaId: string | null;
  nombre: string;
  descripcion: string | null;
  precio: number;
  activoCatalogo: boolean;
  alergenos: string | null;
  orden?: number;
}): Producto {
  boot();
  const db = getDb();
  const pid = data.id || id();
  if (data.id) {
    db.prepare(
      `UPDATE productos SET categoria_id=?, nombre=?, descripcion=?, precio=?,
       activo_catalogo=?, alergenos=?, orden=? WHERE id=?`
    ).run(
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
    db.prepare(
      `INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, activo_catalogo, foto_url, alergenos, orden)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`
    ).run(
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
  return getProducto(pid)!;
}

export function listInsumos(): Insumo[] {
  boot();
  return (
    getDb()
      .prepare(
        `SELECT id, nombre, unidad, stock_actual as stockActual, stock_minimo as stockMinimo,
                costo_unitario as costoUnitario, ubicacion, proveedor_preferido as proveedorPreferido
         FROM insumos ORDER BY nombre`
      )
      .all() as Insumo[]
  );
}

export function upsertInsumo(data: {
  id?: string;
  nombre: string;
  unidad: Insumo["unidad"];
  stockActual: number;
  stockMinimo: number;
  costoUnitario: number;
  ubicacion: string | null;
  proveedorPreferido: string | null;
}): Insumo {
  boot();
  const db = getDb();
  const iid = data.id || id();
  if (data.id) {
    db.prepare(
      `UPDATE insumos SET nombre=?, unidad=?, stock_actual=?, stock_minimo=?,
       costo_unitario=?, ubicacion=?, proveedor_preferido=? WHERE id=?`
    ).run(
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
    db.prepare(
      `INSERT INTO insumos (id, nombre, unidad, stock_actual, stock_minimo, costo_unitario, ubicacion, proveedor_preferido)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
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
  return listInsumos().find((i) => i.id === iid)!;
}

export function getReceta(productoId: string): LineaReceta[] {
  boot();
  return getDb()
    .prepare(
      `SELECT r.id, r.producto_id as productoId, r.insumo_id as insumoId, r.cantidad,
              i.nombre as insumoNombre, i.unidad
       FROM receta_lineas r
       JOIN insumos i ON i.id = r.insumo_id
       WHERE r.producto_id = ?
       ORDER BY i.nombre`
    )
    .all(productoId) as LineaReceta[];
}

export function setReceta(
  productoId: string,
  lineas: Array<{ insumoId: string; cantidad: number }>
) {
  boot();
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM receta_lineas WHERE producto_id = ?`).run(productoId);
    const stmt = db.prepare(
      `INSERT INTO receta_lineas (id, producto_id, insumo_id, cantidad) VALUES (?, ?, ?, ?)`
    );
    for (const l of lineas) {
      if (l.cantidad <= 0) continue;
      stmt.run(id(), productoId, l.insumoId, l.cantidad);
    }
  });
  tx();
  return getReceta(productoId);
}

export function costoTeoricoProducto(productoId: string): number {
  const lineas = getReceta(productoId);
  const insumos = Object.fromEntries(listInsumos().map((i) => [i.id, i]));
  return lineas.reduce((acc, l) => {
    const i = insumos[l.insumoId];
    if (!i) return acc;
    return acc + Math.round(l.cantidad * i.costoUnitario);
  }, 0);
}

export function listDias(from: string, to: string): DiaOperativo[] {
  boot();
  return (
    getDb()
      .prepare(
        `SELECT id, fecha, abierto, deadline_pedido as deadlinePedido,
                cupo_maximo as cupoMaximo, notas
         FROM dias_operativos
         WHERE fecha >= ? AND fecha <= ?
         ORDER BY fecha`
      )
      .all(from, to) as Array<SqliteBool<DiaOperativo, "abierto">>
  ).map((d) => ({ ...d, abierto: !!d.abierto }));
}

export function getDia(fecha: string): DiaOperativo | null {
  boot();
  const d = getDb()
    .prepare(
      `SELECT id, fecha, abierto, deadline_pedido as deadlinePedido,
              cupo_maximo as cupoMaximo, notas
       FROM dias_operativos WHERE fecha = ?`
    )
    .get(fecha) as SqliteBool<DiaOperativo, "abierto"> | undefined;
  if (!d) return null;
  return { ...d, abierto: !!d.abierto };
}

export function upsertDia(data: {
  fecha: string;
  abierto: boolean;
  deadlinePedido: string;
  cupoMaximo: number | null;
  notas: string | null;
}): DiaOperativo {
  boot();
  const db = getDb();
  const existing = getDia(data.fecha);
  if (existing) {
    db.prepare(
      `UPDATE dias_operativos SET abierto=?, deadline_pedido=?, cupo_maximo=?, notas=? WHERE fecha=?`
    ).run(
      data.abierto ? 1 : 0,
      data.deadlinePedido,
      data.cupoMaximo,
      data.notas,
      data.fecha
    );
  } else {
    db.prepare(
      `INSERT INTO dias_operativos (id, fecha, abierto, deadline_pedido, cupo_maximo, notas)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      id(),
      data.fecha,
      data.abierto ? 1 : 0,
      data.deadlinePedido,
      data.cupoMaximo,
      data.notas
    );
  }
  return getDia(data.fecha)!;
}

export function getDisponibilidad(fecha: string): Array<{
  productoId: string;
  disponible: boolean;
  productoNombre: string;
}> {
  boot();
  const rows = getDb()
    .prepare(
      `SELECT d.producto_id as productoId, d.disponible, p.nombre as productoNombre
       FROM disponibilidad_producto_dia d
       JOIN productos p ON p.id = d.producto_id
       WHERE d.fecha = ?
       ORDER BY p.orden, p.nombre`
    )
    .all(fecha) as Array<{
    productoId: string;
    disponible: number;
    productoNombre: string;
  }>;

  if (rows.length === 0) {
    // Si no hay filas, devolver todos los productos del catálogo como no configurados
    return listProductos().map((p) => ({
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

export function setDisponibilidad(
  fecha: string,
  items: Array<{ productoId: string; disponible: boolean }>
) {
  boot();
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO disponibilidad_producto_dia (id, fecha, producto_id, disponible)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(fecha, producto_id) DO UPDATE SET disponible = excluded.disponible`
  );
  const tx = db.transaction(() => {
    for (const it of items) {
      stmt.run(id(), fecha, it.productoId, it.disponible ? 1 : 0);
    }
  });
  tx();
  return getDisponibilidad(fecha);
}

export function copiarDisponibilidad(desde: string, hacia: string) {
  const items = getDisponibilidad(desde).map((i) => ({
    productoId: i.productoId,
    disponible: i.disponible,
  }));
  return setDisponibilidad(hacia, items);
}

export function listZonas(): ZonaEnvio[] {
  boot();
  return (
    getDb()
      .prepare(
        `SELECT id, nombre, cobertura, costo_envio as costoEnvio, activa
         FROM zonas_envio ORDER BY nombre`
      )
      .all() as Array<SqliteBool<ZonaEnvio, "activa">>
  ).map((z) => ({ ...z, activa: !!z.activa }));
}

export function getMenuPorDia(fecha: string): MenuDiaResponse {
  boot();
  const dia = getDia(fecha);
  const config = getConfigPublica();
  const categorias = listCategorias().filter((c) => c.activa);
  const zonas = listZonas().filter((z) => z.activa);
  const disp = Object.fromEntries(
    getDisponibilidad(fecha).map((d) => [d.productoId, d.disponible])
  );
  const productos = listProductos()
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
