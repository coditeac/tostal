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

  const insumos = listInsumos();
  const byId = Object.fromEntries(insumos.map((i) => [i.id, i]));

  const productos = listProductos()
    .filter((p) => p.activoCatalogo)
    .map((p) => {
      const costo = costoTeoricoProducto(p.id);
      const margenPct =
        p.precio > 0
          ? Math.round(((p.precio - costo) / p.precio) * 1000) / 10
          : 0;
      const receta = getReceta(p.id).map((r) => ({
        ...r,
        costoLinea: Math.round(r.cantidad * (byId[r.insumoId]?.costoUnitario || 0)),
      }));
      return {
        id: p.id,
        nombre: p.nombre,
        precio: p.precio,
        costoTeorico: costo,
        margenPct,
        bajoMargen: margenPct < 40,
        receta,
      };
    })
    .sort((a, b) => a.margenPct - b.margenPct);

  return jsonOk({ productos, insumos }, req);
}
