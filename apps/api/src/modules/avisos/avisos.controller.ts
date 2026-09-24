import {
  Body,
  Controller,
  Get,
  Patch,
  Query,
  Req,
  BadRequestException,
} from "@nestjs/common";
import type { Request } from "express";
import { sqlAll, sqlRun } from "../../lib/db";
import { ensureSeed } from "../../lib/seed";
import { requireUser } from "../../common/session.decorator";
import { getConfigPublica } from "../../lib/config";

/** Avisos WhatsApp — cola manual (sin envío automático aún). */
@Controller("whatsapp")
export class AvisosController {
  @Get()
  async get(@Req() req: Request, @Query("estado") estadoParam?: string) {
    await requireUser(req);
    await ensureSeed();
    const estado = estadoParam || "pendiente";
    const avisos = await sqlAll(
      `SELECT id, pedido_id as pedidoId, destinatario, telefono, evento, texto,
              estado, creado_en as creadoEn, enviado_en as enviadoEn
       FROM avisos_whatsapp
       WHERE (? = 'todos' OR estado = ?)
       ORDER BY creado_en DESC
       LIMIT 100`,
      estado,
      estado
    );
    const config = await getConfigPublica();
    return { avisos, telefonoNegocio: config.telefonoWhatsApp };
  }

  @Patch()
  async patch(@Req() req: Request, @Body() body: Record<string, unknown>) {
    await requireUser(req);
    if (!body?.id || !body?.estado) {
      throw new BadRequestException("Faltan datos.");
    }
    await sqlRun(
      `UPDATE avisos_whatsapp SET estado = ?, enviado_en = ? WHERE id = ?`,
      body.estado,
      body.estado === "enviado" ? new Date().toISOString() : null,
      body.id
    );
    return { ok: true };
  }
}
