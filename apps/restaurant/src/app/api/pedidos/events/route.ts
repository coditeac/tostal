import { withCors, optionsCors } from "@/lib/cors";
import { isSessionUser, requireSession } from "@/lib/auth";
import { listPedidos } from "@/lib/pedidos";
import { hoyISO } from "@/lib/utils";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  eventMatchesFecha,
  subscribePedidos,
  type PedidoEvent,
} from "@/lib/pedido-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
  return optionsCors(req);
}

/**
 * SSE autenticado: cola de pedidos del restaurant.
 * GET /api/pedidos/events?fecha=YYYY-MM-DD|todos
 */
export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (!isSessionUser(auth)) return auth;

  const fechaParam = req.nextUrl.searchParams.get("fecha");
  const fecha =
    fechaParam === "todos" ? undefined : fechaParam || hoyISO();

  const pedidos = await listPedidos({
    fecha,
  });

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const sendRaw = (eventName: string, payload: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`)
        );
      };

      sendRaw("snapshot", {
        type: "snapshot",
        at: new Date().toISOString(),
        pedidos,
      });

      cleanup = subscribePedidos((event: PedidoEvent) => {
        if (!eventMatchesFecha(event, fechaParam || fecha || null)) return;
        sendRaw(event.type, event);
      });

      heartbeat = setInterval(() => {
        try {
          sendRaw("ping", { type: "ping", at: new Date().toISOString() });
        } catch {
          if (heartbeat) clearInterval(heartbeat);
        }
      }, 25000);

      req.signal.addEventListener("abort", () => {
        if (heartbeat) clearInterval(heartbeat);
        cleanup?.();
        try {
          controller.close();
        } catch {
          /* closed */
        }
      });
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      cleanup?.();
    },
  });

  const res = new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
  return withCors(res, req);
}
