import { createHmac, timingSafeEqual } from "crypto";
import { getMpAccessToken, getMpWebhookSecret } from "./config";
import { parseExternalReference } from "./external-ref";
import { applyMpPaymentStatus } from "./apply-payment";

export type WebhookProcessResult = {
  ok: boolean;
  ignored?: boolean;
  mock?: boolean;
  error?: string;
  paymentId?: string;
  status?: string;
};

type MpPayment = {
  id?: number | string;
  status?: string;
  external_reference?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Valida x-signature de Mercado Pago.
 * Si no hay secret configurado, acepta (dev/mock) y deja constancia.
 */
export function verifyMpWebhookSignature(opts: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
}): { valid: boolean; skipped: boolean } {
  const secret = getMpWebhookSecret();
  if (!secret) {
    return { valid: true, skipped: true };
  }
  if (!opts.xSignature) {
    return { valid: false, skipped: false };
  }

  const parts = Object.fromEntries(
    opts.xSignature.split(",").map((p) => {
      const [k, ...rest] = p.trim().split("=");
      return [k, rest.join("=")];
    })
  ) as { ts?: string; v1?: string };

  if (!parts.ts || !parts.v1) {
    return { valid: false, skipped: false };
  }

  let manifest = "";
  if (opts.dataId) {
    const id =
      /^[A-Za-z0-9]+$/.test(opts.dataId) && /[A-Z]/.test(opts.dataId)
        ? opts.dataId.toLowerCase()
        : opts.dataId;
    manifest += `id:${id};`;
  }
  if (opts.xRequestId) {
    manifest += `request-id:${opts.xRequestId};`;
  }
  manifest += `ts:${parts.ts};`;

  const expected = createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(parts.v1, "utf8");
    if (a.length !== b.length) return { valid: false, skipped: false };
    return { valid: timingSafeEqual(a, b), skipped: false };
  } catch {
    return { valid: false, skipped: false };
  }
}

async function fetchMpPayment(paymentId: string): Promise<MpPayment | null> {
  const token = getMpAccessToken();
  if (!token) return null;
  const res = await fetch(
    `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }
  );
  if (!res.ok) return null;
  return (await res.json()) as MpPayment;
}

export async function processMercadoPagoWebhook(input: {
  paymentId: string | null;
  topic?: string | null;
  action?: string | null;
  raw: unknown;
  xSignature: string | null;
  xRequestId: string | null;
  dataIdQuery: string | null;
}): Promise<WebhookProcessResult> {
  const paymentId = input.paymentId?.trim() || null;
  if (!paymentId) {
    return { ok: true, ignored: true };
  }

  const sig = verifyMpWebhookSignature({
    xSignature: input.xSignature,
    xRequestId: input.xRequestId,
    dataId: input.dataIdQuery || paymentId,
  });
  if (!sig.valid) {
    return { ok: false, error: "Firma webhook inválida" };
  }

  if (!getMpAccessToken()) {
    return {
      ok: true,
      mock: true,
      ignored: true,
      paymentId,
      error: "Sin MP_ACCESS_TOKEN — webhook ignorado (modo mock)",
    };
  }

  const payment = await fetchMpPayment(paymentId);
  if (!payment?.id) {
    return { ok: false, error: "No se pudo leer el pago en Mercado Pago" };
  }

  const status = String(payment.status || "");
  const external = payment.external_reference || null;

  const parsed = parseExternalReference(external);
  const metaTipo = payment.metadata?.tipo;
  const metaId = payment.metadata?.entidad_id;
  const tipo =
    parsed?.tipo ||
    (metaTipo === "pedido" ||
    metaTipo === "reserva" ||
    metaTipo === "checkout"
      ? metaTipo
      : null);
  const entidadId =
    parsed?.id || (typeof metaId === "string" ? metaId : null);

  if (!tipo || !entidadId) {
    return {
      ok: true,
      ignored: true,
      paymentId: String(payment.id),
      status,
      error: "Sin external_reference reconocible",
    };
  }

  const applied = await applyMpPaymentStatus({
    tipo,
    entidadId,
    paymentId: String(payment.id),
    status,
    externalReference: external || `${tipo}_${entidadId}`,
    topic: input.topic || "payment",
    action: input.action || null,
    payload: payment,
  });

  return {
    ok: applied.ok,
    paymentId: String(payment.id),
    status,
    error: applied.error,
  };
}
