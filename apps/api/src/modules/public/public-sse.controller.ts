import { Controller, Get, Query, Req, Res, BadRequestException } from "@nestjs/common";
import type { Request, Response } from "express";
import {
  eventMatchesPedido,
  subscribePedidos,
  type PedidoEvent,
} from "../../lib/pedido-events";
import { ensureSeed } from "../../lib/seed";
import { getPedido } from "../../lib/pedidos";

@Controller("public/pedidos")
export class PublicSseController {
  @Get("events")
  async events(
    @Query("codigo") codigo: string | undefined,
    @Req() req: Request,
    @Res() res: Response
  ) {
    await ensureSeed();
    if (!codigo) {
      throw new BadRequestException("Indica el código del pedido.");
    }
    const pedido = await getPedido(codigo);
    if (!pedido) {
      res.status(404).json({ error: "Pedido no encontrado." });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const sendRaw = (eventName: string, payload: unknown) => {
      res.write(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`);
    };

    sendRaw("snapshot", {
      type: "snapshot",
      at: new Date().toISOString(),
      pedido,
    });

    const cleanup = subscribePedidos((event: PedidoEvent) => {
      if (!eventMatchesPedido(event, codigo)) return;
      sendRaw(event.type, event);
    });

    const heartbeat = setInterval(() => {
      try {
        sendRaw("ping", { type: "ping", at: new Date().toISOString() });
      } catch {
        clearInterval(heartbeat);
      }
    }, 25000);

    const close = () => {
      clearInterval(heartbeat);
      cleanup();
      try {
        res.end();
      } catch {
        /* closed */
      }
    };

    req.on("close", close);
  }
}
