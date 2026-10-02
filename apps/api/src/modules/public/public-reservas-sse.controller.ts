import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  BadRequestException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import {
  eventMatchesReserva,
  subscribeReservas,
  type ReservaEvent,
} from "../../lib/pedido-events";
import { ensureSeed } from "../../lib/seed";
import { getReserva } from "../../lib/reservas";

@Controller(["public/reservas", "public/reservaciones"])
export class PublicReservasSseController {
  @Get("events")
  async events(
    @Query("codigo") codigo: string | undefined,
    @Req() req: Request,
    @Res() res: Response
  ) {
    await ensureSeed();
    if (!codigo) {
      throw new BadRequestException("Indica el código de la reserva.");
    }
    const reserva = await getReserva(codigo);
    if (!reserva) {
      res.status(404).json({ error: "Reserva no encontrada." });
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
      reserva,
    });

    const cleanup = subscribeReservas((event: ReservaEvent) => {
      if (!eventMatchesReserva(event, codigo)) return;
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
