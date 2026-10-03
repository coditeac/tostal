import { NextRequest, NextResponse } from "next/server";
import { processMercadoPagoWebhook } from "@/lib/mercadopago/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook Mercado Pago (Checkout Pro).
 * URL producción: https://tostal.cafe/api/webhooks/mercadopago
 *
 * Acepta:
 * - Body JSON { type/action/data.id } (webhooks nuevos)
 * - Query ?topic=payment&id=… (IPN legacy)
 */
async function handle(req: NextRequest) {
  const url = new URL(req.url);
  const topicQ = url.searchParams.get("topic") || url.searchParams.get("type");
  const idQ = url.searchParams.get("id") || url.searchParams.get("data.id");

  let body: Record<string, unknown> = {};
  if (req.method === "POST") {
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
  }

  const data = body.data as { id?: string | number } | undefined;
  const paymentId =
    (data?.id != null ? String(data.id) : null) ||
    (typeof body.id === "string" || typeof body.id === "number"
      ? String(body.id)
      : null) ||
    idQ;

  const topic =
    (typeof body.type === "string" && body.type) ||
    (typeof body.topic === "string" && body.topic) ||
    topicQ ||
    "payment";

  // Solo procesamos pagos
  if (topic && !/payment/i.test(topic) && body.type && body.type !== "payment") {
    return NextResponse.json({ ok: true, ignored: true, topic });
  }

  const result = await processMercadoPagoWebhook({
    paymentId,
    topic,
    action: typeof body.action === "string" ? body.action : null,
    raw: body,
    xSignature: req.headers.get("x-signature"),
    xRequestId: req.headers.get("x-request-id"),
    dataIdQuery: url.searchParams.get("data.id") || idQ,
  });

  if (!result.ok) {
    const status = result.error === "Firma webhook inválida" ? 401 : 500;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}
