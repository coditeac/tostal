/**
 * Notificaciones por correo (Resend SDK).
 * - Con RESEND_API_KEY y MAIL_MOCK≠1 → envío real.
 * - Sin key / MAIL_MOCK=1 → mock (log + email_log).
 */
import { Resend } from "resend";
import { sqlAll, sqlRun } from "./db";
import { id } from "./id";
import type { PedidoPublico } from "../../../../shared/types";
import type { ReservaPublica } from "./domain-types";

type MailPayload = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  evento: string;
  pedidoId?: string | null;
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
    process.env.SMTP_FROM ||
    "Tostal <pedidos@tostal.cafe>"
  );
}

function shouldMockMail(): boolean {
  if (process.env.MAIL_MOCK === "1") return true;
  if (process.env.MAIL_MOCK === "0") return !getResend();
  return !getResend();
}

export async function sendMail(payload: MailPayload): Promise<{
  ok: boolean;
  mock: boolean;
  error?: string;
}> {
  const now = new Date().toISOString();
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
        html: payload.html || `<pre style="font-family:sans-serif">${escapeHtml(payload.text)}</pre>`,
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
    try {
      await sqlRun(
        `INSERT INTO email_log (id, pedido_id, destinatario, evento, asunto, estado, error, creado_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        id(),
        payload.pedidoId || null,
        to,
        payload.evento,
        payload.subject,
        estado,
        error || null,
        now
      );
    } catch {
      /* schema aún no listo en tests tempranos */
    }
  }

  return { ok: estado !== "error", mock, error };
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
          Este correo lo envía Tostal sobre tu pedido. Si no pediste nada, ignóralo.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function notifyPedidoCreado(
  pedido: PedidoPublico,
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
    const html = wrapHtml(
      title,
      `<p>¡Hola <strong>${escapeHtml(pedido.clienteNombre)}</strong>!</p>
       <p>Recibimos tu pedido <strong>${escapeHtml(pedido.codigo)}</strong>.</p>
       <p>Fecha de entrega: <strong>${escapeHtml(pedido.fechaEntrega)}</strong><br/>
       Total: <strong>${formatTotal(pedido.total)}</strong><br/>
       Estado: recibido</p>
       <p><a href="https://tostal.cafe/pedido/${encodeURIComponent(pedido.codigo)}" style="color:#9A2E25;">Ver seguimiento</a></p>`
    );
    await sendMail({
      to: email,
      subject: `Pedido ${pedido.codigo} recibido — Tostal`,
      text,
      html,
      evento: "pedido_creado",
      pedidoId: pedido.id,
    });
  }

  await notifyStaffNuevoPedido(pedido);
}

async function staffNotifyEmails(): Promise<string[]> {
  const configured = (process.env.STAFF_NOTIFY_EMAIL || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (configured.length) return configured;

  const rows = await sqlAll<{ email: string }>(
    `SELECT email FROM usuarios
     WHERE activo = 1 AND rol IN ('superadmin','admin')`
  );
  return rows.map((r) => r.email).filter(Boolean);
}

async function notifyStaffNuevoPedido(pedido: PedidoPublico) {
  const to = await staffNotifyEmails();
  if (!to.length) return;
  const text = [
    `Nuevo pedido ${pedido.codigo}`,
    `Cliente: ${pedido.clienteNombre}`,
    `Entrega: ${pedido.fechaEntrega} (${pedido.modoEntrega})`,
    `Total: ${formatTotal(pedido.total)}`,
    `Canal: ${pedido.canal}`,
    ``,
    `Panel: https://app.tostal.cafe/panel/pedidos`,
  ].join("\n");
  await sendMail({
    to,
    subject: `Nuevo pedido ${pedido.codigo} — Tostal`,
    text,
    html: wrapHtml(
      `Nuevo pedido ${escapeHtml(pedido.codigo)}`,
      `<p>Cliente: <strong>${escapeHtml(pedido.clienteNombre)}</strong><br/>
       Entrega: ${escapeHtml(pedido.fechaEntrega)} (${escapeHtml(pedido.modoEntrega)})<br/>
       Total: <strong>${formatTotal(pedido.total)}</strong><br/>
       Canal: ${escapeHtml(pedido.canal)}</p>
       <p><a href="https://app.tostal.cafe/panel/pedidos" style="color:#9A2E25;">Abrir panel</a></p>`
    ),
    evento: "staff_pedido_creado",
    pedidoId: pedido.id,
  });
}

export async function notifyEstadoPedido(
  pedido: PedidoPublico,
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
    // legacy
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
    cancelado: motivo
      ? `Motivo: ${motivo}`
      : "Si tienes dudas, escríbenos.",
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

  const html = wrapHtml(
    `Pedido ${escapeHtml(pedido.codigo)} ${escapeHtml(label)}`,
    `<p>Hola <strong>${escapeHtml(pedido.clienteNombre)}</strong>,</p>
     <p>Tu pedido <strong>${escapeHtml(pedido.codigo)}</strong> está <strong>${escapeHtml(label)}</strong>.</p>
     <p>${escapeHtml(extras[pedido.estado] || "")}</p>
     <p><a href="https://tostal.cafe/pedido/${encodeURIComponent(pedido.codigo)}" style="color:#9A2E25;">Ver seguimiento</a></p>`
  );

  await sendMail({
    to: email,
    subject: `Pedido ${pedido.codigo} ${label} — Tostal`,
    text,
    html,
    evento: `estado_${pedido.estado}`,
    pedidoId: pedido.id,
  });
}

export async function notifyPagoConfirmado(
  pedido: PedidoPublico,
  email?: string | null
) {
  if (!email) return;
  const text = [
    `Hola ${pedido.clienteNombre},`,
    ``,
    `Confirmamos el pago de tu pedido ${pedido.codigo} (${formatTotal(pedido.total)}).`,
    ``,
    `— Tostal`,
  ].join("\n");
  await sendMail({
    to: email,
    subject: `Pago confirmado — pedido ${pedido.codigo}`,
    text,
    html: wrapHtml(
      "Pago confirmado",
      `<p>Hola <strong>${escapeHtml(pedido.clienteNombre)}</strong>,</p>
       <p>Confirmamos el pago de tu pedido <strong>${escapeHtml(pedido.codigo)}</strong> (${formatTotal(pedido.total)}).</p>`
    ),
    evento: "pago_confirmado",
    pedidoId: pedido.id,
  });
}

export async function notifyReservaCreada(
  reserva: ReservaPublica,
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
      `Anticipo a pagar: ${formatTotal(reserva.anticipoMonto)} (${reserva.estadoAnticipo})`,
      ``,
      `Puedes verla en https://tostal.cafe/reserva/${reserva.codigo}`,
      ``,
      `— Tostal`,
    ].join("\n");
    const html = wrapHtml(
      title,
      `<p>¡Hola <strong>${escapeHtml(reserva.clienteNombre)}</strong>!</p>
       <p>Recibimos tu reserva <strong>${escapeHtml(reserva.codigo)}</strong>.</p>
       <p>Fecha: <strong>${escapeHtml(reserva.fechaEntrega)}</strong><br/>
       Total: <strong>${formatTotal(reserva.total)}</strong><br/>
       Anticipo: <strong>${formatTotal(reserva.anticipoMonto)}</strong> (${escapeHtml(reserva.estadoAnticipo)})</p>
       <p><a href="https://tostal.cafe/reserva/${encodeURIComponent(reserva.codigo)}" style="color:#9A2E25;">Ver reserva</a></p>`
    );
    await sendMail({
      to: email,
      subject: `Reserva ${reserva.codigo} recibida — Tostal`,
      text,
      html,
      evento: "reserva_creada",
      pedidoId: null,
    });
    // Log con reserva_id si la columna existe
    try {
      await sqlRun(
        `UPDATE email_log SET reserva_id = ? WHERE evento = 'reserva_creada' AND destinatario = ? AND creado_en >= ?`,
        reserva.id,
        email,
        new Date(Date.now() - 60_000).toISOString()
      );
    } catch {
      /* ignore */
    }
  }

  const to = await staffNotifyEmails();
  if (!to.length) return;
  await sendMail({
    to,
    subject: `Nueva reserva ${reserva.codigo} — Tostal`,
    text: [
      `Nueva reserva ${reserva.codigo}`,
      `Cliente: ${reserva.clienteNombre}`,
      `Fecha: ${reserva.fechaEntrega}`,
      `Anticipo: ${formatTotal(reserva.anticipoMonto)}`,
      `Total: ${formatTotal(reserva.total)}`,
      ``,
      `Panel: https://app.tostal.cafe/panel/reservas`,
    ].join("\n"),
    html: wrapHtml(
      `Nueva reserva ${escapeHtml(reserva.codigo)}`,
      `<p>Cliente: <strong>${escapeHtml(reserva.clienteNombre)}</strong><br/>
       Fecha: ${escapeHtml(reserva.fechaEntrega)}<br/>
       Anticipo: <strong>${formatTotal(reserva.anticipoMonto)}</strong><br/>
       Total: <strong>${formatTotal(reserva.total)}</strong></p>
       <p><a href="https://app.tostal.cafe/panel/reservas" style="color:#9A2E25;">Abrir reservas</a></p>`
    ),
    evento: "staff_reserva_creada",
    pedidoId: null,
  });
}

export async function notifyAnticipoConfirmado(
  reserva: ReservaPublica,
  email?: string | null
) {
  if (!email) return;
  const text = [
    `Hola ${reserva.clienteNombre},`,
    ``,
    `Confirmamos el anticipo de tu reserva ${reserva.codigo} (${formatTotal(reserva.anticipoMonto)}).`,
    `Fecha: ${reserva.fechaEntrega}`,
    `Estado: ${reserva.estado}`,
    ``,
    `— Tostal`,
  ].join("\n");
  await sendMail({
    to: email,
    subject: `Anticipo confirmado — reserva ${reserva.codigo}`,
    text,
    html: wrapHtml(
      "Anticipo confirmado",
      `<p>Hola <strong>${escapeHtml(reserva.clienteNombre)}</strong>,</p>
       <p>Confirmamos el anticipo de tu reserva <strong>${escapeHtml(reserva.codigo)}</strong> (${formatTotal(reserva.anticipoMonto)}).</p>
       <p>Fecha: <strong>${escapeHtml(reserva.fechaEntrega)}</strong></p>`
    ),
    evento: "anticipo_confirmado",
    pedidoId: null,
  });
}

export async function notifyEstadoReserva(
  reserva: ReservaPublica,
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
    cancelado: motivo
      ? `Motivo: ${motivo}`
      : "Si tienes dudas, escríbenos.",
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

  const html = wrapHtml(
    `Reserva ${escapeHtml(reserva.codigo)} ${escapeHtml(label)}`,
    `<p>Hola <strong>${escapeHtml(reserva.clienteNombre)}</strong>,</p>
     <p>Tu reserva <strong>${escapeHtml(reserva.codigo)}</strong> está <strong>${escapeHtml(label)}</strong>.</p>
     <p>${escapeHtml(extras[reserva.estado] || "")}</p>
     <p>Fecha: <strong>${escapeHtml(reserva.fechaEntrega)}</strong></p>
     <p><a href="https://tostal.cafe/reserva/${encodeURIComponent(reserva.codigo)}" style="color:#9A2E25;">Ver seguimiento</a></p>`
  );

  await sendMail({
    to: email,
    subject: `Reserva ${reserva.codigo} ${label} — Tostal`,
    text,
    html,
    evento: `reserva_estado_${reserva.estado}`,
    pedidoId: null,
  });
  try {
    await sqlRun(
      `UPDATE email_log SET reserva_id = ? WHERE evento = ? AND destinatario = ? AND creado_en >= ?`,
      reserva.id,
      `reserva_estado_${reserva.estado}`,
      email,
      new Date(Date.now() - 60_000).toISOString()
    );
  } catch {
    /* ignore */
  }
}
