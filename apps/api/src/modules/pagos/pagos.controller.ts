import {
  Body,
  Controller,
  Get,
  Headers,
  Patch,
  Post,
  Req,
  BadRequestException,
  HttpCode,
} from "@nestjs/common";
import type { Request } from "express";
import { requireUser } from "../../common/session.decorator";
import { marcarPago } from "../../lib/pedidos";
import {
  createCheckoutSessionForPedido,
  createPaymentIntentForPedido,
  handleStripeWebhook,
  mockConfirmStripePago,
  stripeConfigured,
  stripePublishableKey,
} from "../../lib/stripe";

/**
 * Pagos: transferencia (manual), contra entrega, Stripe (solo procesador).
 * Sin sync de catálogo Stripe — amount desde pedido Tostal.
 */
@Controller("pagos")
export class PagosController {
  @Get()
  async info() {
    return {
      metodos: [
        "transferencia",
        "stripe",
        "contra_entrega",
        "efectivo_mostrador",
      ],
      stripe: {
        configured: stripeConfigured(),
        publishableKey: stripePublishableKey(),
        mode: stripeConfigured() ? "live_or_test_key" : "mock",
        note: "PaymentIntent / Checkout Session con price_data. Sin Products Stripe.",
      },
    };
  }

  /** Staff: marca pago (transferencia manual, etc.). */
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

  /** Cliente: crea PaymentIntent con monto del pedido. */
  @Post("stripe/intent")
  @HttpCode(200)
  async stripeIntent(@Body() body: { pedidoId?: string; codigo?: string }) {
    const key = body.pedidoId || body.codigo;
    if (!key) throw new BadRequestException("Indica pedidoId o codigo.");
    const result = await createPaymentIntentForPedido(String(key));
    if (!result.ok) throw new BadRequestException(result.error);
    return result;
  }

  /** Cliente: Checkout Session con line_items price_data ad-hoc. */
  @Post("stripe/checkout")
  @HttpCode(200)
  async stripeCheckout(
    @Body()
    body: {
      pedidoId?: string;
      codigo?: string;
      successUrl?: string;
      cancelUrl?: string;
    }
  ) {
    const key = body.pedidoId || body.codigo;
    if (!key) throw new BadRequestException("Indica pedidoId o codigo.");
    const base =
      process.env.NEXT_PUBLIC_CLIENTE_URL || "https://tostal.cafe";
    const result = await createCheckoutSessionForPedido(String(key), {
      successUrl:
        body.successUrl ||
        `${base}/pedido/{CODIGO}?pago=ok`,
      cancelUrl:
        body.cancelUrl || `${base}/pedido/{CODIGO}?pago=cancelado`,
    });
    if (!result.ok) throw new BadRequestException(result.error);
    return result;
  }

  /** Solo mock (sin STRIPE_SECRET_KEY). */
  @Post("stripe/mock-confirm")
  @HttpCode(200)
  async mockConfirm(@Body() body: { pedidoId?: string; codigo?: string }) {
    const key = body.pedidoId || body.codigo;
    if (!key) throw new BadRequestException("Indica pedidoId o codigo.");
    const result = await mockConfirmStripePago(String(key));
    if (!result.ok) throw new BadRequestException(result.error);
    return result;
  }

  /** Webhook Stripe — raw body + firma. */
  @Post("stripe/webhook")
  @HttpCode(200)
  async webhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers("stripe-signature") signature?: string
  ) {
    const raw =
      req.rawBody ||
      (typeof req.body === "string"
        ? Buffer.from(req.body)
        : Buffer.from(JSON.stringify(req.body || {})));
    const result = await handleStripeWebhook(raw, signature);
    if (!result.ok) throw new BadRequestException(result.error);
    return { received: true, handled: result.handled };
  }
}
