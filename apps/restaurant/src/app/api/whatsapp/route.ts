import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";
import { isSessionUser, requireSession } from "@/lib/auth";
import { jsonError, jsonOk, optionsCors } from "@/lib/cors";
import { getConfigPublica } from "@/lib/config";

export async function OPTIONS(req: NextRequest) {
  return optionsCors(req);
}

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (!isSessionUser(auth)) return auth;
  ensureSeed();
  const estado = req.nextUrl.searchParams.get("estado") || "pendiente";
  const avisos = getDb()
    .prepare(
      `SELECT id, pedido_id as pedidoId, destinatario, telefono, evento, texto,
              estado, creado_en as creadoEn, enviado_en as enviadoEn
       FROM avisos_whatsapp
       WHERE (? = 'todos' OR estado = ?)
       ORDER BY creado_en DESC
       LIMIT 100`
    )
    .all(estado, estado);
  const config = getConfigPublica();
  return jsonOk({ avisos, telefonoNegocio: config.telefonoWhatsApp }, req);
}

export async function PATCH(req: NextRequest) {
  const auth = await requireSession();
  if (!isSessionUser(auth)) return auth;
  const body = await req.json().catch(() => null);
  if (!body?.id || !body?.estado) return jsonError("Faltan datos.", req);
  getDb()
    .prepare(
      `UPDATE avisos_whatsapp SET estado = ?, enviado_en = ? WHERE id = ?`
    )
    .run(
      body.estado,
      body.estado === "enviado" ? new Date().toISOString() : null,
      body.id
    );
  return jsonOk({ ok: true }, req);
}
