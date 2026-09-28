import {
  Body,
  Controller,
  Get,
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
import type { EstadoReserva } from "../../lib/domain-types";

@Controller(["reservas", "reservaciones"])
export class ReservasController {
  @Get()
  async list(
    @Req() req: Request,
    @Query("fecha") fecha?: string,
    @Query("estado") estado?: string
  ) {
    await requireUser(req);
    const reservas = await listReservas({ fecha, estado });
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
    const reserva = await getReserva(id);
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

  @Patch("estado")
  async estado(
    @Req() req: Request,
    @Body() body: { id?: string; estado?: EstadoReserva }
  ) {
    await requireUser(req, ["admin", "cocina"]);
    if (!body?.id || !body?.estado) {
      throw new BadRequestException("Faltan id y estado.");
    }
    const ok: EstadoReserva[] = [
      "pendiente_anticipo",
      "confirmada",
      "en_produccion",
      "lista",
      "entregada",
      "cancelada",
    ];
    if (!ok.includes(body.estado)) {
      throw new BadRequestException("Estado inválido.");
    }
    const reserva = await actualizarEstadoReserva(body.id, body.estado);
    if (!reserva) throw new NotFoundException("Reserva no encontrada.");
    return { reserva };
  }

  @Patch("anticipo")
  async anticipo(@Req() req: Request, @Body() body: { id?: string }) {
    await requireUser(req, ["admin"]);
    if (!body?.id) throw new BadRequestException("Falta id.");
    const reserva = await confirmarAnticipoReserva(body.id);
    if (!reserva) throw new NotFoundException("Reserva no encontrada.");
    return { reserva };
  }
}
