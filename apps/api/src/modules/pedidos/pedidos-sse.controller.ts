import { Controller, Get, Query, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { requireUser } from "../../common/session.decorator";
import { listPedidos } from "../../lib/pedidos";
import { hoyISO } from "../../lib/utils";
import {
  eventMatchesFecha,
  subscribePedidos,
  type PedidoEvent,
} from "../../lib/pedido-events";

@Controller("pedidos")
export class PedidosSseController {
  @Get("events")
  async events(
    @Req() req: Request,
    @Res() res: Response,
    @Query("fecha") fechaParam?: string
  ) {
    await requireUser(req);
    const fecha =
      fechaParam === "todos" ? undefined : fechaParam || hoyISO();
    const pedidos = await listPedidos({ fecha });

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
      pedidos,
    });

    const cleanup = subscribePedidos((event: PedidoEvent) => {
      if (!eventMatchesFecha(event, fechaParam || fecha || null)) return;
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
