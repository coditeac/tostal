import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  BadRequestException,
} from "@nestjs/common";
import type { Request } from "express";
import { requireUser } from "../../common/session.decorator";
import { marcarPago } from "../../lib/pedidos";

/**
 * Pagos de pedidos (estado de pago).
 * Alias explícito del dominio "pagos" — misma lógica que PATCH /api/pedidos.
 */
@Controller("pagos")
export class PagosController {
  @Get()
  async info(@Req() req: Request) {
    await requireUser(req);
    return {
      metodos: [
        "transferencia",
        "stripe",
        "contra_entrega",
        "efectivo_mostrador",
      ],
      nota: "Actualiza estado con PATCH /api/pagos o PATCH /api/pedidos",
    };
  }

  @Patch()
  async patch(@Req() req: Request, @Body() body: Record<string, unknown>) {
    await requireUser(req);
    if (!body?.id || !body?.estadoPago) {
      throw new BadRequestException("Faltan id o estadoPago.");
    }
    const pedido = await marcarPago(
      String(body.id),
      body.estadoPago as "pendiente" | "pagado" | "reembolsado"
    );
    return { pedido };
  }
}
