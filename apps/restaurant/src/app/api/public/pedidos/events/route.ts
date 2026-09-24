import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  eventMatchesPedido,
  subscribePedidos,
  type PedidoEvent,
} from "@/lib/pedido-events";
import { withCors, optionsCors, jsonError } from "@/lib/cors";
import { ensureSeed } from "@/lib/seed";
import { getPedido } from "@/lib/pedidos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
  return optionsCors(req);
}

/**
 * SSE público: seguimiento de un pedido por código.
 * GET /api/public/pedidos/events?codigo=T-MMDD-NNNN
 */
export async function GET(req: NextRequest) {
  await ensureSeed();
  const codigo = req.nextUrl.searchParams.get("codigo");
  if (!codigo) {
    return jsonError("Indica el código del pedido.", req);
  }

  const pedido = await getPedido(codigo);
  if (!pedido) {
    return jsonError("Pedido no encontrado.", req, 404);
  }

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const sendRaw = (eventName: string, payload: unknown) => {
        controller.enqueue(
          encoder.encode(
            `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`
          )
        );
      };

      sendRaw("snapshot", {
        type: "snapshot",
        at: new Date().toISOString(),
        pedido,
      });

      cleanup = subscribePedidos((event: PedidoEvent) => {
        if (!eventMatchesPedido(event, codigo)) return;
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
