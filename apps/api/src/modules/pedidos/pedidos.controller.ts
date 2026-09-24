import {
  Body,
  Controller,
  Get,
  Patch,
  Query,
  Req,
  BadRequestException,
} from "@nestjs/common";
import type { Request } from "express";
import {
  actualizarEstadoPedido,
  listPedidos,
  marcarPago,
} from "../../lib/pedidos";
import { requireUser } from "../../common/session.decorator";
import { hoyISO } from "../../lib/utils";

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
      const result = await actualizarEstadoPedido(
        String(body.id),
        body.estado as
          | "recibido"
          | "confirmado"
          | "en_produccion"
          | "listo"
          | "entregado"
          | "cancelado",
        auth.id
      );
      if (!result.ok) throw new BadRequestException(result.error);
      return { pedido: result.pedido };
    }
    throw new BadRequestException("Nada que actualizar.");
  }
}
