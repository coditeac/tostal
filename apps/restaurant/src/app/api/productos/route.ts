import { NextRequest } from "next/server";
import {
  listProductos,
  listCategorias,
  upsertProducto,
  getReceta,
  setReceta,
  costoTeoricoProducto,
} from "@/lib/catalogo";
import { isSessionUser, requireSession } from "@/lib/auth";
import { jsonError, jsonOk, optionsCors } from "@/lib/cors";
import { aCentavos } from "@/lib/utils";

export async function OPTIONS(req: NextRequest) {
  return optionsCors(req);
}

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (!isSessionUser(auth)) return auth;
  const productos = listProductos().map((p) => {
    const costo = costoTeoricoProducto(p.id);
    const margen =
      p.precio > 0 ? Math.round(((p.precio - costo) / p.precio) * 1000) / 10 : 0;
    return {
      ...p,
      costoTeorico: costo,
      margenPct: margen,
      receta: getReceta(p.id),
    };
  });
  return jsonOk({ productos, categorias: listCategorias() }, req);
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["admin"]);
  if (!isSessionUser(auth)) return auth;
  const body = await req.json().catch(() => null);
  if (!body?.nombre) return jsonError("El nombre es obligatorio.", req);
  const precio =
    typeof body.precio === "number"
      ? body.precio > 1000
        ? Math.round(body.precio)
        : aCentavos(body.precio)
      : aCentavos(Number(body.precioPesos || 0));

  const producto = upsertProducto({
    categoriaId: body.categoriaId || null,
    nombre: String(body.nombre),
    descripcion: body.descripcion || null,
    precio,
    activoCatalogo: body.activoCatalogo !== false,
    alergenos: body.alergenos || null,
    orden: body.orden ?? 0,
  });

  if (Array.isArray(body.receta)) {
    setReceta(
      producto.id,
      body.receta.map((r: { insumoId: string; cantidad: number }) => ({
        insumoId: r.insumoId,
        cantidad: Number(r.cantidad),
      }))
    );
  }

  return jsonOk({ producto, receta: getReceta(producto.id) }, req, 201);
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(["admin"]);
  if (!isSessionUser(auth)) return auth;
  const body = await req.json().catch(() => null);
  if (!body?.id) return jsonError("Falta id.", req);
  const precio =
    typeof body.precio === "number"
      ? body.precio > 1000
        ? Math.round(body.precio)
        : aCentavos(body.precio)
      : undefined;

  const producto = upsertProducto({
    id: body.id,
    categoriaId: body.categoriaId ?? null,
    nombre: String(body.nombre),
    descripcion: body.descripcion ?? null,
    precio: precio ?? 0,
    activoCatalogo: body.activoCatalogo !== false,
    alergenos: body.alergenos ?? null,
    orden: body.orden ?? 0,
  });

  if (Array.isArray(body.receta)) {
    setReceta(
      producto.id,
      body.receta.map((r: { insumoId: string; cantidad: number }) => ({
        insumoId: r.insumoId,
        cantidad: Number(r.cantidad),
      }))
    );
  }

  return jsonOk({
    producto,
    receta: getReceta(producto.id),
    costoTeorico: costoTeoricoProducto(producto.id),
  }, req);
}
