/** Config server-only Mercado Pago (Checkout Pro). */

export function getMpAccessToken(): string | null {
  const t = process.env.MP_ACCESS_TOKEN?.trim();
  return t || null;
}

/** Secreto de firma webhook (panel MP → Webhooks → secret). */
export function getMpWebhookSecret(): string | null {
  const s =
    process.env.MP_WEBHOOK_SECRET?.trim() ||
    process.env.MP_WEBHOOK_SECRET_KEY?.trim();
  return s || null;
}

export function isMpConfigured(): boolean {
  return Boolean(getMpAccessToken());
}

/** Origen público Cliente (back_urls + notification_url). */
export function getClientePublicOrigin(): string {
  const explicit =
    process.env.NEXT_PUBLIC_CLIENTE_URL?.trim() ||
    process.env.CLIENTE_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") return "https://tostal.cafe";
  return "http://127.0.0.1:4322";
}

export function centavosToMxn(centavos: number): number {
  return Math.round(centavos) / 100;
}
