import {
  centavosToMxn,
  getClientePublicOrigin,
  getMpAccessToken,
  isMpConfigured,
} from "./config";
import { buildExternalReference, type MpEntidad } from "./external-ref";

export type CrearPreferenciaInput = {
  tipo: MpEntidad;
  id: string;
  codigo: string;
  /** Monto a cobrar en centavos (total pedido o anticipo reserva). */
  montoCentavos: number;
  titulo: string;
  payerEmail?: string | null;
  payerNombre?: string | null;
};

export type CrearPreferenciaResult =
  | {
      ok: true;
      mock: false;
      preferenceId: string;
      checkoutUrl: string;
      externalReference: string;
    }
  | {
      ok: true;
      mock: true;
      preferenceId: null;
      checkoutUrl: null;
      externalReference: string;
      message: string;
    }
  | { ok: false; error: string };

type PreferenceApiResponse = {
  id?: string;
  init_point?: string;
  sandbox_init_point?: string;
  message?: string;
  error?: string;
};

export async function crearPreferenciaCheckoutPro(
  input: CrearPreferenciaInput
): Promise<CrearPreferenciaResult> {
  const monto = Math.round(input.montoCentavos);
  if (!Number.isFinite(monto) || monto < 1) {
    return { ok: false, error: "El monto a cobrar no es válido." };
  }

  const externalReference = buildExternalReference(input.tipo, input.id);
  const origin = getClientePublicOrigin();
  const path =
    input.tipo === "pedido"
      ? `/pedido/${encodeURIComponent(input.codigo)}`
      : `/reserva/${encodeURIComponent(input.codigo)}`;

  if (!isMpConfigured()) {
    return {
      ok: true,
      mock: true,
      preferenceId: null,
      checkoutUrl: null,
      externalReference,
      message:
        "Mercado Pago en modo demo (falta MP_ACCESS_TOKEN). El pago se marca como pagado en local/Railway sin keys.",
    };
  }

  const token = getMpAccessToken()!;
  const unitPrice = centavosToMxn(monto);

  const body = {
    items: [
      {
        id: input.codigo,
        title: input.titulo.slice(0, 250),
        quantity: 1,
        currency_id: "MXN",
        unit_price: unitPrice,
      },
    ],
    payer: {
      ...(input.payerEmail ? { email: input.payerEmail } : {}),
      ...(input.payerNombre
        ? { name: input.payerNombre.slice(0, 80) }
        : {}),
    },
    back_urls: {
      success: `${origin}${path}?pago=ok`,
      failure: `${origin}${path}?pago=error`,
      pending: `${origin}${path}?pago=pending`,
    },
    auto_return: "approved",
    notification_url: `${origin}/api/webhooks/mercadopago`,
    external_reference: externalReference,
    statement_descriptor: "TOSTAL",
    metadata: {
      tipo: input.tipo,
      codigo: input.codigo,
      entidad_id: input.id,
    },
  };

  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as PreferenceApiResponse;
  if (!res.ok || !data.id) {
    const msg =
      data.message ||
      data.error ||
      `Mercado Pago respondió ${res.status}`;
    return { ok: false, error: msg };
  }

  const checkoutUrl = data.init_point || data.sandbox_init_point;
  if (!checkoutUrl) {
    return {
      ok: false,
      error: "Mercado Pago no devolvió URL de checkout.",
    };
  }

  return {
    ok: true,
    mock: false,
    preferenceId: data.id,
    checkoutUrl,
    externalReference,
  };
}
