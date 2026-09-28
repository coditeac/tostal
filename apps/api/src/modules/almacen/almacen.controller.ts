import {
  Body,
  Controller,
  Get,
  Post,
  Put,
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
import { listInsumos, upsertInsumo } from "../../lib/catalogo";
import type { TipoMovimiento } from "../../../../../shared/types";
import { aCentavos } from "../../lib/utils";

/**
 * Módulo Almacén (panel 6 módulos).
 * Alias amigable de inventario + umbral "pocos" / alertas.
 * Rutas: /api/almacen (y sigue existiendo /api/inventario).
 */
@Controller("almacen")
export class AlmacenController {
  @Get()
  async get(
    @Req() req: Request,
    @Query("insumoId") insumoId?: string,
    @Query("vista") vista?: string
  ) {
    await requireUser(req);
    const alertas = await alertasStock();
    if (vista === "alertas" || vista === "pocos") {
      return {
        alertas,
        pocos: alertas,
        total_pocos: alertas.length,
        criticos: alertas.filter((a) => a.critico).length,
      };
    }
    const insumos = (await listInsumos()).map((i) => ({
      ...i,
      bajoMinimo: i.stockActual <= i.stockMinimo,
      pocos: i.stockActual <= i.stockMinimo,
      stock_actual: i.stockActual,
      stock_minimo: i.stockMinimo,
      umbral_pocos: i.stockMinimo,
    }));
    return {
      insumos,
      alertas,
      pocos: alertas,
      total_pocos: alertas.length,
      movimientos: await listMovimientos({ insumoId, limit: 60 }),
    };
  }

  /** Actualizar umbral "pocos" (stock_minimo) o stock. */
  @Put("umbral")
  async umbral(@Req() req: Request, @Body() body: Record<string, unknown>) {
    await requireUser(req, ["admin"]);
    if (!body?.insumoId && !body?.id) {
      throw new BadRequestException("Falta id de insumo.");
    }
    const existing = (await listInsumos()).find(
      (i) => i.id === String(body.insumoId || body.id)
    );
    if (!existing) throw new BadRequestException("Insumo no encontrado.");
    const stockMinimo =
      body.stockMinimo != null
        ? Number(body.stockMinimo)
        : body.umbral_pocos != null
          ? Number(body.umbral_pocos)
          : existing.stockMinimo;
    const insumo = await upsertInsumo({
      id: existing.id,
      nombre: existing.nombre,
      unidad: existing.unidad,
      stockActual:
        body.stockActual != null
          ? Number(body.stockActual)
          : existing.stockActual,
      stockMinimo,
      costoUnitario: existing.costoUnitario,
      ubicacion: existing.ubicacion,
      proveedorPreferido: existing.proveedorPreferido,
    });
    return {
      insumo: {
        ...insumo,
        pocos: insumo.stockActual <= insumo.stockMinimo,
        umbral_pocos: insumo.stockMinimo,
      },
      alertas: await alertasStock(),
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
    const alertas = await alertasStock();
    return {
      ok: true,
      alertas,
      pocos: alertas,
      movimientos: await listMovimientos({ limit: 40 }),
    };
  }
}
