import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
  Header,
} from "@nestjs/common";
import type { Response } from "express";
import { readLocalMedia } from "../../lib/media-storage";

/**
 * Sirve archivos locales del volumen (jpg/png/webp).
 * GET /api/media/productos/:file
 */
@Controller("media")
export class MediaController {
  @Get("productos/:file")
  @Header("Cache-Control", "public, max-age=86400, immutable")
  async productoFoto(
    @Param("file") file: string,
    @Res() res: Response
  ) {
    if (!file || file.includes("..") || file.includes("/")) {
      throw new NotFoundException("Archivo no encontrado.");
    }
    const media = await readLocalMedia(`productos/${file}`);
    if (!media) throw new NotFoundException("Archivo no encontrado.");
    res.setHeader("Content-Type", media.mime);
    res.setHeader("Content-Length", String(media.buffer.length));
    res.send(media.buffer);
  }
}
