import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import type { Request } from "express";
import { requireUser } from "../../common/session.decorator";
import {
  actualizarEstadoReserva,
  confirmarAnticipoReserva,
  getNecesidades,
  getReserva,
  listReservas,
  sugerirComprasDesdeReservas,
} from "../../lib/reservas";
import { ESTADOS_UNIFICADOS, normalizarEstado } from "../../lib/estados";

@Controller(["reservas", "reservaciones"])
export class ReservasController {
  @Get()
  async list(
    @Req() req: Request,
    @Query("fecha") fecha?: string,
    @Query("estado") estado?: string
  ) {
    await requireUser(req);
    const estadoNorm = estado ? normalizarEstado(estado) || estado : undefined;
    const reservas = await listReservas({ fecha, estado: estadoNorm });
    return {
      reservas: reservas.map((r) => ({
        ...r,
        insumos_necesarios: r.necesidades,
        requiere_compra: r.requiereCompra,
        sugerencias_compra: r.necesidades
          .filter((n) => n.requiereCompra)
          .map((n) => ({
            insumo_id: n.insumoId,
            insumo_nombre: n.insumoNombre,
            unidad: n.unidad,
            faltante: n.faltante,
          })),
      })),
    };
  }

  @Get("compras-sugeridas")
  async compras(@Req() req: Request, @Query("fecha") fecha?: string) {
    await requireUser(req);
    const data = await sugerirComprasDesdeReservas(fecha);
    return {
      ...data,
      items: data.items.map((i) => ({
        ...i,
        insumo_id: i.insumoId,
        insumo_nombre: i.insumoNombre,
        cantidad_faltante: i.cantidadFaltante,
      })),
    };
  }

  @Get("detalle")
  async detalle(@Req() req: Request, @Query("id") id?: string) {
    await requireUser(req);
    if (!id) throw new BadRequestException("Falta id o código.");
    const reserva = await getReserva(id, { conHistorial: true });
    if (!reserva) throw new NotFoundException("Reserva no encontrada.");
    const necesidades = await getNecesidades(reserva.id);
    return {
      reserva,
      necesidades,
      insumos_necesarios: necesidades,
      requiere_compra: necesidades.some((n) => n.requiereCompra),
      requiereCompra: necesidades.some((n) => n.requiereCompra),
      sugerencias_compra: necesidades
        .filter((n) => n.requiereCompra)
        .map((n) => ({
          insumo_id: n.insumoId,
          insumo_nombre: n.insumoNombre,
          unidad: n.unidad,
          faltante: n.faltante,
        })),
    };
  }

  /** Contrato: PATCH /api/reservas/:id/estado (y /reservaciones/…) */
  @Patch(":id/estado")
  async patchEstadoParam(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { estado?: string; motivo?: string }
  ) {
    const auth = await requireUser(req, [
      "superadmin",
      "admin",
      "cocina",
      "caja",
    ]);
    if (!body?.estado) throw new BadRequestException("Falta estado.");
    const canon = normalizarEstado(body.estado);
    if (!canon) {
      throw new BadRequestException(
        `Estado inválido. Usa: ${ESTADOS_UNIFICADOS.join(", ")}.`
      );
    }
    const result = await actualizarEstadoReserva(id, canon, {
      usuarioId: auth.id,
      motivo: body.motivo || null,
    });
    if (!result.ok) throw new BadRequestException(result.error);
    return { reserva: result.reserva };
  }

  /** Legacy: PATCH /api/reservas/estado { id, estado } */
  @Patch("estado")
  async estado(
    @Req() req: Request,
    @Body() body: { id?: string; estado?: string; motivo?: string }
  ) {
    const auth = await requireUser(req, [
      "superadmin",
      "admin",
      "cocina",
      "caja",
    ]);
    if (!body?.id || !body?.estado) {
      throw new BadRequestException("Faltan id y estado.");
    }
    const canon = normalizarEstado(body.estado);
    if (!canon) {
      throw new BadRequestException(
        `Estado inválido. Usa: ${ESTADOS_UNIFICADOS.join(", ")}.`
      );
    }
    const result = await actualizarEstadoReserva(body.id, canon, {
      usuarioId: auth.id,
      motivo: body.motivo || null,
    });
    if (!result.ok) {
      if (result.error.includes("no encontrada")) {
        throw new NotFoundException(result.error);
      }
      throw new BadRequestException(result.error);
    }
    return { reserva: result.reserva };
  }

  @Patch("anticipo")
  async anticipo(@Req() req: Request, @Body() body: { id?: string }) {
    await requireUser(req, ["admin", "superadmin"]);
    if (!body?.id) throw new BadRequestException("Falta id.");
    const reserva = await confirmarAnticipoReserva(body.id);
    if (!reserva) throw new NotFoundException("Reserva no encontrada.");
    return { reserva };
  }
}
