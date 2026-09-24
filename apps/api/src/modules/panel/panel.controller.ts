import { Controller, Get, Req } from "@nestjs/common";
import type { Request } from "express";
import { requireUser } from "../../common/session.decorator";
import { listPedidos } from "../../lib/pedidos";
import { listInsumos } from "../../lib/catalogo";
import { getConfigPublica } from "../../lib/config";
import { sqlGet } from "../../lib/db";
import { hoyISO } from "../../lib/utils";
import { ensureSeed } from "../../lib/seed";

/** Resumen del panel restaurant (sustituye SSR con DB directa). */
@Controller("panel")
export class PanelController {
  @Get("resumen")
  async resumen(@Req() req: Request) {
    await requireUser(req);
    await ensureSeed();
    const hoy = hoyISO();
    const pedidosHoy = await listPedidos({ fecha: hoy });
    const insumos = await listInsumos();
    const bajos = insumos.filter((i) => i.stockActual <= i.stockMinimo);
    const config = await getConfigPublica();
    const avisosPendientes =
      (
        await sqlGet<{ c: number }>(
          `SELECT COUNT(*) as c FROM avisos_whatsapp WHERE estado = 'pendiente'`
        )
      )?.c ?? 0;
    const activos = pedidosHoy.filter((p) => p.estado !== "cancelado");
    const totalVentas = activos.reduce((a, p) => a + p.total, 0);
    return {
      hoy,
      config,
      pedidosHoy,
      activosCount: activos.length,
      totalVentas,
      insumosBajos: bajos,
      avisosPendientes,
    };
  }
}
