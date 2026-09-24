/**
 * Notificaciones por correo.
 * - Producción: SMTP (Resend SMTP / cualquier SMTP) vía vars.
 * - Local sin SMTP: mock (log a consola + tabla email_log).
 */
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { sqlRun } from "./db";
import { id } from "./id";
import type { PedidoPublico } from "../../../../shared/types";

type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  evento: string;
  pedidoId?: string | null;
};

let _transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (_transporter !== undefined) return _transporter;
  const host = process.env.SMTP_HOST || process.env.RESEND_SMTP_HOST;
  const user = process.env.SMTP_USER || process.env.RESEND_SMTP_USER;
  const pass = process.env.SMTP_PASS || process.env.RESEND_API_KEY;
  if (!host || !user || !pass) {
    _transporter = null;
    return null;
  }
  _transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== "0",
    auth: { user, pass },
  });
  return _transporter;
}

export function mailFrom(): string {
  return (
    process.env.MAIL_FROM ||
    process.env.SMTP_FROM ||
    "Tostal <noreply@tostal.cafe>"
  );
}

export async function sendMail(payload: MailPayload): Promise<{
  ok: boolean;
  mock: boolean;
  error?: string;
}> {
  const now = new Date().toISOString();
  const transport = getTransporter();
  let estado = "enviado";
  let error: string | undefined;
  let mock = false;

  if (!transport || process.env.MAIL_MOCK === "1") {
    mock = true;
    estado = "mock";
    console.info(
      `[mail:mock] → ${payload.to} | ${payload.subject}\n${payload.text}`
    );
  } else {
    try {
      await transport.sendMail({
        from: mailFrom(),
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html || `<pre>${payload.text}</pre>`,
      });
    } catch (e) {
      estado = "error";
      error = e instanceof Error ? e.message : String(e);
      console.error("[mail:error]", error);
    }
  }

  try {
    await sqlRun(
      `INSERT INTO email_log (id, pedido_id, destinatario, evento, asunto, estado, error, creado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id(),
      payload.pedidoId || null,
      payload.to,
      payload.evento,
      payload.subject,
      estado,
      error || null,
      now
    );
  } catch {
    /* schema aún no listo en tests tempranos */
  }

  return { ok: estado !== "error", mock, error };
}

function formatTotal(centavos: number) {
  return `$${(centavos / 100).toFixed(2)} MXN`;
}

export async function notifyPedidoCreado(
  pedido: PedidoPublico,
  email?: string | null
) {
  if (!email) return;
  const text = [
    `¡Hola ${pedido.clienteNombre}!`,
    ``,
    `Recibimos tu pedido ${pedido.codigo} en Tostal.`,
    `Fecha de entrega: ${pedido.fechaEntrega}`,
    `Total: ${formatTotal(pedido.total)}`,
    `Estado: recibido`,
    ``,
    `Puedes seguirlo en https://tostal.cafe/pedido/${pedido.codigo}`,
    ``,
    `— Tostal`,
  ].join("\n");
  await sendMail({
    to: email,
    subject: `Pedido ${pedido.codigo} recibido — Tostal`,
    text,
    evento: "pedido_creado",
    pedidoId: pedido.id,
  });
}

export async function notifyEstadoPedido(
  pedido: PedidoPublico,
  email?: string | null
) {
  if (!email) return;
  const titulos: Record<string, string> = {
    confirmado: "confirmado",
    en_produccion: "en preparación",
    listo: "listo",
    entregado: "entregado",
    cancelado: "cancelado",
  };
  const label = titulos[pedido.estado];
  if (!label) return;

  const extras: Record<string, string> = {
    listo:
      pedido.modoEntrega === "retiro"
        ? "Ya puedes pasar a retirarlo."
        : "Pronto sale a envío.",
    entregado: "Gracias por pedir en Tostal.",
  };

  const text = [
    `Hola ${pedido.clienteNombre},`,
    ``,
    `Tu pedido ${pedido.codigo} está ${label}.`,
    extras[pedido.estado] || "",
    ``,
    `Seguimiento: https://tostal.cafe/pedido/${pedido.codigo}`,
    ``,
    `— Tostal`,
  ]
    .filter(Boolean)
    .join("\n");

  await sendMail({
    to: email,
    subject: `Pedido ${pedido.codigo} ${label} — Tostal`,
    text,
    evento: `estado_${pedido.estado}`,
    pedidoId: pedido.id,
  });
}

export async function notifyPagoConfirmado(
  pedido: PedidoPublico,
  email?: string | null
) {
  if (!email) return;
  await sendMail({
    to: email,
    subject: `Pago confirmado — pedido ${pedido.codigo}`,
    text: [
      `Hola ${pedido.clienteNombre},`,
      ``,
      `Confirmamos el pago de tu pedido ${pedido.codigo} (${formatTotal(pedido.total)}).`,
      ``,
      `— Tostal`,
    ].join("\n"),
    evento: "pago_confirmado",
    pedidoId: pedido.id,
  });
}
