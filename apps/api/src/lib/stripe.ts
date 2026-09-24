/**
 * Stripe = solo procesador. Sin Products/Prices/Catalog en Stripe.
 * Monto desde pedido Tostal (centavos). Metadata: pedidoId, codigo.
 */
import Stripe from "stripe";
import { getPedido, marcarPago } from "./pedidos";
import { sqlRun, sqlGet } from "./db";
import { id } from "./id";

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function stripePublishableKey(): string | null {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null;
}

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export type StripeIntentResult =
  | {
      ok: true;
      mock: boolean;
      clientSecret: string;
      paymentIntentId: string;
      publishableKey: string | null;
      amount: number;
      currency: string;
    }
  | { ok: false; error: string };

/** PaymentIntent con amount del pedido (no catalog Stripe). */
export async function createPaymentIntentForPedido(
  codigoOrId: string
): Promise<StripeIntentResult> {
  const pedido = await getPedido(codigoOrId);
  if (!pedido) return { ok: false, error: "Pedido no encontrado." };
  if (pedido.metodoPago !== "stripe") {
    return { ok: false, error: "Este pedido no usa Stripe." };
  }
  if (pedido.estadoPago === "pagado") {
    return { ok: false, error: "El pedido ya está pagado." };
  }
  if (pedido.total < 1) {
    return { ok: false, error: "Monto inválido." };
  }

  const currency = (process.env.STRIPE_CURRENCY || "mxn").toLowerCase();
  const stripe = getStripe();

  if (!stripe) {
    // Mock local / sin keys
    const mockId = `pi_mock_${pedido.id.slice(0, 8)}`;
    await sqlRun(
      `UPDATE pedidos SET stripe_payment_intent_id = ?, actualizado_en = ? WHERE id = ?`,
      mockId,
      new Date().toISOString(),
      pedido.id
    );
    return {
      ok: true,
      mock: true,
      clientSecret: `${mockId}_secret_mock`,
      paymentIntentId: mockId,
      publishableKey: null,
      amount: pedido.total,
      currency,
    };
  }

  const existing = await sqlGet<{ stripe_payment_intent_id: string | null }>(
    `SELECT stripe_payment_intent_id FROM pedidos WHERE id = ?`,
    pedido.id
  );
  if (existing?.stripe_payment_intent_id?.startsWith("pi_")) {
    try {
      const prev = await stripe.paymentIntents.retrieve(
        existing.stripe_payment_intent_id
      );
      if (
        prev.status !== "succeeded" &&
        prev.status !== "canceled" &&
        prev.amount === pedido.total
      ) {
        return {
          ok: true,
          mock: false,
          clientSecret: prev.client_secret!,
          paymentIntentId: prev.id,
          publishableKey: stripePublishableKey(),
          amount: pedido.total,
          currency,
        };
      }
    } catch {
      /* crear nuevo */
    }
  }

  const pi = await stripe.paymentIntents.create({
    amount: pedido.total,
    currency,
    automatic_payment_methods: { enabled: true },
    metadata: {
      pedidoId: pedido.id,
      codigo: pedido.codigo,
    },
    description: `Tostal pedido ${pedido.codigo}`,
  });

  await sqlRun(
    `UPDATE pedidos SET stripe_payment_intent_id = ?, actualizado_en = ? WHERE id = ?`,
    pi.id,
    new Date().toISOString(),
    pedido.id
  );

  return {
    ok: true,
    mock: false,
    clientSecret: pi.client_secret!,
    paymentIntentId: pi.id,
    publishableKey: stripePublishableKey(),
    amount: pedido.total,
    currency,
  };
}

/**
 * Checkout Session ad-hoc con price_data (sin Price/Product persistentes en Stripe).
 */
export async function createCheckoutSessionForPedido(
  codigoOrId: string,
  urls: { successUrl: string; cancelUrl: string }
): Promise<
  | { ok: true; mock: boolean; url: string; sessionId: string }
  | { ok: false; error: string }
> {
  const pedido = await getPedido(codigoOrId);
  if (!pedido) return { ok: false, error: "Pedido no encontrado." };
  if (pedido.metodoPago !== "stripe") {
    return { ok: false, error: "Este pedido no usa Stripe." };
  }
  if (pedido.estadoPago === "pagado") {
    return { ok: false, error: "El pedido ya está pagado." };
  }

  const currency = (process.env.STRIPE_CURRENCY || "mxn").toLowerCase();
  const stripe = getStripe();

  if (!stripe) {
    const success = urls.successUrl.replace("{CODIGO}", pedido.codigo);
    const sep = success.includes("?") ? "&" : "?";
    return {
      ok: true,
      mock: true,
      url: `${success}${sep}pago=mock`,
      sessionId: `cs_mock_${id().slice(0, 8)}`,
    };
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
    pedido.lineas.map((l) => ({
      quantity: l.cantidad,
      price_data: {
        currency,
        unit_amount: l.precioUnitario,
        product_data: {
          name: l.productoNombre,
        },
      },
    }));

  if (pedido.costoEnvio > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency,
        unit_amount: pedido.costoEnvio,
        product_data: { name: "Envío Tostal" },
      },
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    success_url: urls.successUrl.replace("{CODIGO}", pedido.codigo),
    cancel_url: urls.cancelUrl.replace("{CODIGO}", pedido.codigo),
    metadata: {
      pedidoId: pedido.id,
      codigo: pedido.codigo,
    },
    payment_intent_data: {
      metadata: {
        pedidoId: pedido.id,
        codigo: pedido.codigo,
      },
    },
  });

  if (session.payment_intent && typeof session.payment_intent === "string") {
    await sqlRun(
      `UPDATE pedidos SET stripe_payment_intent_id = ?, actualizado_en = ? WHERE id = ?`,
      session.payment_intent,
      new Date().toISOString(),
      pedido.id
    );
  }

  return {
    ok: true,
    mock: false,
    url: session.url!,
    sessionId: session.id,
  };
}

/** Confirma mock (solo sin STRIPE_SECRET_KEY). */
export async function mockConfirmStripePago(codigoOrId: string) {
  if (stripeConfigured()) {
    return { ok: false as const, error: "Stripe real activo; usa webhook." };
  }
  const pedido = await getPedido(codigoOrId);
  if (!pedido) return { ok: false as const, error: "Pedido no encontrado." };
  const updated = await marcarPago(pedido.id, "pagado");
  return { ok: true as const, pedido: updated };
}

export async function handleStripeWebhook(
  rawBody: Buffer | string,
  signature: string | undefined
): Promise<{ ok: true; handled: string } | { ok: false; error: string }> {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return { ok: false, error: "Webhook Stripe no configurado." };
  }
  if (!signature) {
    return { ok: false, error: "Falta firma Stripe." };
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Firma inválida",
    };
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const pedidoId = pi.metadata?.pedidoId;
    const codigo = pi.metadata?.codigo;
    const key = pedidoId || codigo;
    if (key) {
      const pedido = await getPedido(key);
      if (pedido) {
        await sqlRun(
          `UPDATE pedidos SET stripe_payment_intent_id = ? WHERE id = ?`,
          pi.id,
          pedido.id
        );
        await marcarPago(pedido.id, "pagado");
      }
    }
    return { ok: true, handled: event.type };
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const pedidoId = session.metadata?.pedidoId;
    const codigo = session.metadata?.codigo;
    const key = pedidoId || codigo;
    if (key && session.payment_status === "paid") {
      const pedido = await getPedido(key);
      if (pedido) {
        if (typeof session.payment_intent === "string") {
          await sqlRun(
            `UPDATE pedidos SET stripe_payment_intent_id = ? WHERE id = ?`,
            session.payment_intent,
            pedido.id
          );
        }
        await marcarPago(pedido.id, "pagado");
      }
    }
    return { ok: true, handled: event.type };
  }

  return { ok: true, handled: event.type };
}
