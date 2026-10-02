import { Controller, Get, Req } from "@nestjs/common";
import type { Request } from "express";
import { requireUser } from "../../common/session.decorator";
import {
  costoTeoricoProducto,
  getReceta,
  listInsumos,
  listProductos,
} from "../../lib/catalogo";

@Controller("costos")
export class CostosController {
  @Get()
  async get(@Req() req: Request) {
    await requireUser(req);
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
      const receta = (await getReceta(p.id)).map((r) => {
        const costoUnit = byId[r.insumoId]?.costoUnitario || 0;
        return {
          ...r,
          costoLinea: Math.round(r.por_pieza * costoUnit),
          costoLineaLote: Math.round(r.cantidad * costoUnit),
        };
      });
      productos.push({
        id: p.id,
        nombre: p.nombre,
        precio: p.precio,
        costoTeorico: costo,
        costo_calculado: costo,
        receta_rendimiento: p.recetaRendimiento,
        margenPct,
        bajoMargen: margenPct < 40,
        receta,
      });
    }
    productos.sort((a, b) => a.margenPct - b.margenPct);
    return { productos, insumos };
  }
}
