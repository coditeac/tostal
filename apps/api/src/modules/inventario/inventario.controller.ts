import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  BadRequestException,
  HttpCode,
} from "@nestjs/common";
import type { Request } from "express";
import { requireUser } from "../../common/session.decorator";
import {
  alertasStock,
  listMovimientos,
  registrarMovimiento,
} from "../../lib/inventario";
import { listInsumos } from "../../lib/catalogo";
import type { TipoMovimiento } from "../../../../../shared/types";
import { aCentavos } from "../../lib/utils";

@Controller("inventario")
export class InventarioController {
  @Get()
  async get(
    @Req() req: Request,
    @Query("insumoId") insumoId?: string,
    @Query("vista") vista?: string
  ) {
    await requireUser(req);
    if (vista === "alertas") {
      return { alertas: await alertasStock() };
    }
    return {
      insumos: (await listInsumos()).map((i) => ({
        ...i,
        bajoMinimo: i.stockActual <= i.stockMinimo,
      })),
      alertas: await alertasStock(),
      movimientos: await listMovimientos({ insumoId, limit: 60 }),
    };
  }

  @Post()
  @HttpCode(201)
  async post(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const auth = await requireUser(req, ["admin", "cocina"]);
    if (!body?.insumoId || !body?.tipo || body.cantidad == null) {
      throw new BadRequestException("Faltan insumo, tipo o cantidad.");
    }
    const tipos: TipoMovimiento[] = [
      "entrada",
      "salida",
      "ajuste",
      "merma",
      "produccion",
    ];
    if (!tipos.includes(body.tipo as TipoMovimiento)) {
      throw new BadRequestException("Tipo de movimiento no válido.");
    }
    const costo =
      body.costoPesos != null
        ? aCentavos(Number(body.costoPesos))
        : body.costoUnitario != null
          ? Number(body.costoUnitario)
          : null;

    const result = await registrarMovimiento({
      insumoId: String(body.insumoId),
      tipo: body.tipo as TipoMovimiento,
      cantidad: Number(body.cantidad),
      motivo: (body.motivo as string) || null,
      usuarioId: auth.id,
      actualizarCosto: costo,
    });
    if (!result.ok) throw new BadRequestException(result.error);
    return {
      ok: true,
      alertas: await alertasStock(),
      movimientos: await listMovimientos({ limit: 40 }),
    };
  }
}
