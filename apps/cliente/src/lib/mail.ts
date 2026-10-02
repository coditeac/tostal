/**
 * Notificaciones Resend post-cutover Supabase.
 * Mock si falta RESEND_API_KEY o MAIL_MOCK=1 (no bloquea el flujo).
 */
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/server";

export type MailPayload = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  evento: string;
  pedidoId?: string | null;
  reservaId?: string | null;
};

export type PedidoMail = {
  id: string;
  codigo: string;
  clienteNombre: string;
  fechaEntrega: string;
  total: number;
  estado: string;
  modoEntrega?: string | null;
  canal?: string | null;
};

export type ReservaMail = {
  id: string;
  codigo: string;
  clienteNombre: string;
  fechaEntrega: string;
  total: number;
  anticipoMonto: number;
  estado: string;
  estadoAnticipo?: string | null;
  modoEntrega?: string | null;
};

let _resend: Resend | null | undefined;

function getResend(): Resend | null {
  if (_resend !== undefined) return _resend;
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    _resend = null;
    return null;
  }
  _resend = new Resend(key);
  return _resend;
}

export function mailFrom(): string {
  return (
    process.env.RESEND_FROM ||
    process.env.MAIL_FROM ||
    "Tostal <pedidos@tostal.cafe>"
  );
}

function shouldMockMail(): boolean {
  if (process.env.MAIL_MOCK === "1") return true;
  return !getResend();
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTotal(centavos: number) {
  return `$${(centavos / 100).toFixed(2)} MXN`;
}

function wrapHtml(title: string, bodyHtml: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;background:#f6f3ee;font-family:Georgia,'Times New Roman',serif;color:#2a211c;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f3ee;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e8e0d6;">
        <tr><td style="background:#9A2E25;padding:20px 24px;color:#D6D2C4;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-weight:700;letter-spacing:0.12em;font-size:18px;">TOSTAL</div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.18em;opacity:0.9;margin-top:4px;">SABORES QUE UNEN CULTURAS</div>
        </td></tr>
        <tr><td style="padding:24px;">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;">${title}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:16px 24px 24px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#7a6f66;">
          Este correo lo envía Tostal. Si no pediste nada, ignóralo.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function logEmail(row: {
  destinatario: string;
  evento: string;
  asunto: string;
  estado: string;
  error?: string | null;
  pedidoId?: string | null;
  reservaId?: string | null;
}) {
  try {
    const admin = createServiceClient();
    if (!admin) return;
    await admin.from("email_log").insert({
      pedido_id: row.pedidoId || null,
      reserva_id: row.reservaId || null,
      destinatario: row.destinatario,
      evento: row.evento,
      asunto: row.asunto,
      estado: row.estado,
      error: row.error || null,
    });
  } catch (e) {
    console.warn("[mail:log]", e instanceof Error ? e.message : e);
  }
}

export async function sendMail(payload: MailPayload): Promise<{
  ok: boolean;
  mock: boolean;
  error?: string;
}> {
  const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];
  const toList = recipients.map((t) => t.trim()).filter(Boolean);
  if (!toList.length) return { ok: false, mock: false, error: "Sin destinatario" };

  let estado = "enviado";
  let error: string | undefined;
  let mock = false;
  const client = getResend();

  if (shouldMockMail() || !client) {
    mock = true;
    estado = "mock";
    console.info(
      `[mail:mock] → ${toList.join(", ")} | ${payload.subject}\n${payload.text}`
    );
  } else {
    try {
      const result = await client.emails.send({
        from: mailFrom(),
        to: toList,
        subject: payload.subject,
        text: payload.text,
        html:
          payload.html ||
          `<pre style="font-family:sans-serif">${escapeHtml(payload.text)}</pre>`,
      });
      if (result.error) {
        estado = "error";
        error = result.error.message || String(result.error);
        console.error("[mail:error]", error);
      }
    } catch (e) {
      estado = "error";
      error = e instanceof Error ? e.message : String(e);
      console.error("[mail:error]", error);
    }
  }

  for (const to of toList) {
    await logEmail({
      destinatario: to,
      evento: payload.evento,
      asunto: payload.subject,
      estado,
      error,
      pedidoId: payload.pedidoId,
      reservaId: payload.reservaId,
    });
  }

  return { ok: estado !== "error", mock, error };
}

function staffNotifyEmails(): string[] {
  return (process.env.STAFF_NOTIFY_EMAIL || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function notifyPedidoCreado(
  pedido: PedidoMail,
  email?: string | null
) {
  if (email) {
    const title = `Pedido ${pedido.codigo} recibido`;
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
      html: wrapHtml(
        title,
        `<p>¡Hola <strong>${escapeHtml(pedido.clienteNombre)}</strong>!</p>
         <p>Recibimos tu pedido <strong>${escapeHtml(pedido.codigo)}</strong>.</p>
         <p>Fecha de entrega: <strong>${escapeHtml(pedido.fechaEntrega)}</strong><br/>
         Total: <strong>${formatTotal(pedido.total)}</strong><br/>
         Estado: recibido</p>
         <p><a href="https://tostal.cafe/pedido/${encodeURIComponent(pedido.codigo)}" style="color:#9A2E25;">Ver seguimiento</a></p>`
      ),
      evento: "pedido_creado",
      pedidoId: pedido.id,
    });
  }

  const staff = staffNotifyEmails();
  if (!staff.length) return;
  await sendMail({
    to: staff,
    subject: `Nuevo pedido ${pedido.codigo} — Tostal`,
    text: [
      `Nuevo pedido ${pedido.codigo}`,
      `Cliente: ${pedido.clienteNombre}`,
      `Entrega: ${pedido.fechaEntrega} (${pedido.modoEntrega || "retiro"})`,
      `Total: ${formatTotal(pedido.total)}`,
      `Canal: ${pedido.canal || "remoto"}`,
      ``,
      `Panel: https://app.tostal.cafe/pedidos`,
    ].join("\n"),
    html: wrapHtml(
      `Nuevo pedido ${escapeHtml(pedido.codigo)}`,
      `<p>Cliente: <strong>${escapeHtml(pedido.clienteNombre)}</strong><br/>
       Entrega: ${escapeHtml(pedido.fechaEntrega)} (${escapeHtml(pedido.modoEntrega || "retiro")})<br/>
       Total: <strong>${formatTotal(pedido.total)}</strong></p>
       <p><a href="https://app.tostal.cafe/pedidos" style="color:#9A2E25;">Abrir panel</a></p>`
    ),
    evento: "staff_pedido_creado",
    pedidoId: pedido.id,
  });
}

export async function notifyEstadoPedido(
  pedido: PedidoMail,
  email?: string | null,
  motivo?: string | null
) {
  if (!email) return;
  const titulos: Record<string, string> = {
    recibido: "recibido",
    aceptado: "aceptado",
    preparando: "en preparación",
    listo: "listo (esperando recolección)",
    en_camino: "en camino",
    entregado: "entregado",
    cancelado: "cancelado",
    confirmado: "aceptado",
    en_produccion: "en preparación",
  };
  const label = titulos[pedido.estado];
  if (!label) return;

  const extras: Record<string, string> = {
    recibido: "Ya lo tenemos registrado.",
    aceptado: "Ya lo tenemos en cola.",
    preparando: "Nuestro equipo lo está preparando.",
    listo:
      pedido.modoEntrega === "retiro"
        ? "Ya puedes pasar a retirarlo."
        : "Pronto sale a envío.",
    en_camino: "Va hacia tu dirección.",
    entregado: "Gracias por pedir en Tostal.",
    cancelado: motivo ? `Motivo: ${motivo}` : "Si tienes dudas, escríbenos.",
    confirmado: "Ya lo tenemos en cola.",
    en_produccion: "Nuestro equipo lo está preparando.",
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
    html: wrapHtml(
      `Pedido ${escapeHtml(pedido.codigo)} ${escapeHtml(label)}`,
      `<p>Hola <strong>${escapeHtml(pedido.clienteNombre)}</strong>,</p>
       <p>Tu pedido <strong>${escapeHtml(pedido.codigo)}</strong> está <strong>${escapeHtml(label)}</strong>.</p>
       <p>${escapeHtml(extras[pedido.estado] || "")}</p>
       <p><a href="https://tostal.cafe/pedido/${encodeURIComponent(pedido.codigo)}" style="color:#9A2E25;">Ver seguimiento</a></p>`
    ),
    evento: `estado_${pedido.estado}`,
    pedidoId: pedido.id,
  });
}

export async function notifyReservaCreada(
  reserva: ReservaMail,
  email?: string | null
) {
  if (email) {
    const title = `Reserva ${reserva.codigo} recibida`;
    const text = [
      `¡Hola ${reserva.clienteNombre}!`,
      ``,
      `Recibimos tu reserva ${reserva.codigo} en Tostal.`,
      `Fecha: ${reserva.fechaEntrega}`,
      `Total: ${formatTotal(reserva.total)}`,
      `Anticipo a pagar: ${formatTotal(reserva.anticipoMonto)} (${reserva.estadoAnticipo || "pendiente"})`,
      ``,
      `Puedes verla en https://tostal.cafe/reserva/${reserva.codigo}`,
      ``,
      `— Tostal`,
    ].join("\n");
    await sendMail({
      to: email,
      subject: `Reserva ${reserva.codigo} recibida — Tostal`,
      text,
      html: wrapHtml(
        title,
        `<p>¡Hola <strong>${escapeHtml(reserva.clienteNombre)}</strong>!</p>
         <p>Recibimos tu reserva <strong>${escapeHtml(reserva.codigo)}</strong>.</p>
         <p>Fecha: <strong>${escapeHtml(reserva.fechaEntrega)}</strong><br/>
         Total: <strong>${formatTotal(reserva.total)}</strong><br/>
         Anticipo: <strong>${formatTotal(reserva.anticipoMonto)}</strong> (${escapeHtml(reserva.estadoAnticipo || "pendiente")})</p>
         <p><a href="https://tostal.cafe/reserva/${encodeURIComponent(reserva.codigo)}" style="color:#9A2E25;">Ver reserva</a></p>`
      ),
      evento: "reserva_creada",
      reservaId: reserva.id,
    });
  }

  const staff = staffNotifyEmails();
  if (!staff.length) return;
  await sendMail({
    to: staff,
    subject: `Nueva reserva ${reserva.codigo} — Tostal`,
    text: [
      `Nueva reserva ${reserva.codigo}`,
      `Cliente: ${reserva.clienteNombre}`,
      `Fecha: ${reserva.fechaEntrega}`,
      `Anticipo: ${formatTotal(reserva.anticipoMonto)}`,
      `Total: ${formatTotal(reserva.total)}`,
      ``,
      `Panel: https://app.tostal.cafe/reservaciones`,
    ].join("\n"),
    html: wrapHtml(
      `Nueva reserva ${escapeHtml(reserva.codigo)}`,
      `<p>Cliente: <strong>${escapeHtml(reserva.clienteNombre)}</strong><br/>
       Fecha: ${escapeHtml(reserva.fechaEntrega)}<br/>
       Anticipo: <strong>${formatTotal(reserva.anticipoMonto)}</strong><br/>
       Total: <strong>${formatTotal(reserva.total)}</strong></p>
       <p><a href="https://app.tostal.cafe/reservaciones" style="color:#9A2E25;">Abrir reservas</a></p>`
    ),
    evento: "staff_reserva_creada",
    reservaId: reserva.id,
  });
}

export async function notifyEstadoReserva(
  reserva: ReservaMail,
  email?: string | null,
  motivo?: string | null
) {
  if (!email) return;
  const titulos: Record<string, string> = {
    recibido: "recibida",
    aceptado: "aceptada",
    preparando: "en preparación",
    listo: "lista (esperando recolección)",
    en_camino: "en camino",
    entregado: "entregada",
    cancelado: "cancelada",
  };
  const label = titulos[reserva.estado];
  if (!label) return;

  const extras: Record<string, string> = {
    recibido: "Registramos tu reserva.",
    aceptado: "Confirmamos tu reserva.",
    preparando: "Nuestro equipo la está preparando.",
    listo:
      reserva.modoEntrega === "retiro"
        ? "Ya puedes pasar a retirarla."
        : "Pronto sale a envío.",
    en_camino: "Va hacia tu dirección.",
    entregado: "Gracias por reservar en Tostal.",
    cancelado: motivo ? `Motivo: ${motivo}` : "Si tienes dudas, escríbenos.",
  };

  const text = [
    `Hola ${reserva.clienteNombre},`,
    ``,
    `Tu reserva ${reserva.codigo} está ${label}.`,
    extras[reserva.estado] || "",
    `Fecha: ${reserva.fechaEntrega}`,
    ``,
    `Seguimiento: https://tostal.cafe/reserva/${reserva.codigo}`,
    ``,
    `— Tostal`,
  ]
    .filter(Boolean)
    .join("\n");

  await sendMail({
    to: email,
    subject: `Reserva ${reserva.codigo} ${label} — Tostal`,
    text,
    html: wrapHtml(
      `Reserva ${escapeHtml(reserva.codigo)} ${escapeHtml(label)}`,
      `<p>Hola <strong>${escapeHtml(reserva.clienteNombre)}</strong>,</p>
       <p>Tu reserva <strong>${escapeHtml(reserva.codigo)}</strong> está <strong>${escapeHtml(label)}</strong>.</p>
       <p>${escapeHtml(extras[reserva.estado] || "")}</p>
       <p>Fecha: <strong>${escapeHtml(reserva.fechaEntrega)}</strong></p>
       <p><a href="https://tostal.cafe/reserva/${encodeURIComponent(reserva.codigo)}" style="color:#9A2E25;">Ver seguimiento</a></p>`
    ),
    evento: `reserva_estado_${reserva.estado}`,
    reservaId: reserva.id,
  });
}
