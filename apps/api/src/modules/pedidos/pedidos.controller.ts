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
import {
  actualizarEstadoPedido,
  getPedido,
  listPedidos,
  marcarPago,
} from "../../lib/pedidos";
import { requireUser } from "../../common/session.decorator";
import { hoyISO } from "../../lib/utils";
import { ESTADOS_UNIFICADOS, normalizarEstado } from "../../lib/estados";

@Controller("pedidos")
export class PedidosController {
  @Get()
  async list(
    @Req() req: Request,
    @Query("fecha") fecha?: string,
    @Query("canal") canal?: string
  ) {
    await requireUser(req);
    const pedidos = await listPedidos({
      fecha: fecha === "todos" ? undefined : fecha || hoyISO(),
      canal: canal || undefined,
    });
    return { pedidos };
  }

  @Get("detalle")
  async detalle(@Req() req: Request, @Query("id") id?: string) {
    await requireUser(req);
    if (!id) throw new BadRequestException("Falta id o código.");
    const pedido = await getPedido(id, { conHistorial: true });
    if (!pedido) throw new NotFoundException("Pedido no encontrado.");
    return { pedido };
  }

  /** Contrato: PATCH /api/pedidos/:id/estado */
  @Patch(":id/estado")
  async patchEstadoParam(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { estado?: string; motivo?: string }
  ) {
    const auth = await requireUser(req, ["superadmin", "admin", "cocina", "caja"]);
    if (!body?.estado) throw new BadRequestException("Falta estado.");
    const canon = normalizarEstado(body.estado);
    if (!canon) {
      throw new BadRequestException(
        `Estado inválido. Usa: ${ESTADOS_UNIFICADOS.join(", ")}.`
      );
    }
    const result = await actualizarEstadoPedido(
      id,
      canon,
      auth.id,
      body.motivo || null
    );
    if (!result.ok) throw new BadRequestException(result.error);
    return { pedido: result.pedido };
  }

  /** Legacy: PATCH /api/pedidos { id, estado | estadoPago } */
  @Patch()
  async patch(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const auth = await requireUser(req);
    if (!body?.id) throw new BadRequestException("Falta id.");

    if (body.estadoPago) {
      const pedido = await marcarPago(
        String(body.id),
        body.estadoPago as "pendiente" | "pagado" | "reembolsado"
      );
      return { pedido };
    }
    if (body.estado) {
      const canon = normalizarEstado(String(body.estado));
      if (!canon) {
        throw new BadRequestException(
          `Estado inválido. Usa: ${ESTADOS_UNIFICADOS.join(", ")}.`
        );
      }
      const result = await actualizarEstadoPedido(
        String(body.id),
        canon,
        auth.id,
        body.motivo ? String(body.motivo) : null
      );
      if (!result.ok) throw new BadRequestException(result.error);
      return { pedido: result.pedido };
    }
    throw new BadRequestException("Nada que actualizar.");
  }
}
