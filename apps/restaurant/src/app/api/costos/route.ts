import { NextRequest } from "next/server";
import { isSessionUser, requireSession } from "@/lib/auth";
import { jsonOk, optionsCors } from "@/lib/cors";
import {
  costoTeoricoProducto,
  getReceta,
  listInsumos,
  listProductos,
} from "@/lib/catalogo";

export async function OPTIONS(req: NextRequest) {
  return optionsCors(req);
}

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (!isSessionUser(auth)) return auth;

  const insumos = await listInsumos();
  const byId = Object.fromEntries(insumos.map((i) => [i.id, i]));

  const productosRaw = (await listProductos()).filter((p) => p.activoCatalogo);
  const productos = [];
  for (const p of productosRaw) {
    const costo = await costoTeoricoProducto(p.id);
    const margenPct =
      p.precio > 0
        ? Math.round(((p.precio - costo) / p.precio) * 1000) / 10
        : 0;
    const receta = (await getReceta(p.id)).map((r) => ({
      ...r,
      costoLinea: Math.round(
        r.cantidad * (byId[r.insumoId]?.costoUnitario || 0)
      ),
    }));
    productos.push({
      id: p.id,
      nombre: p.nombre,
      precio: p.precio,
      costoTeorico: costo,
      margenPct,
      bajoMargen: margenPct < 40,
      receta,
    });
  }
  productos.sort((a, b) => a.margenPct - b.margenPct);

  return jsonOk({ productos, insumos }, req);
}
