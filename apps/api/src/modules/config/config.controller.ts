import {
  Body,
  Controller,
  Get,
  Put,
  Req,
  BadRequestException,
} from "@nestjs/common";
import type { Request } from "express";
import { getConfigPublica, getConfigMap, setConfig } from "../../lib/config";
import { getSessionFromRequest } from "../../lib/auth";
import { requireUser } from "../../common/session.decorator";

@Controller("config")
export class ConfigController {
  @Get()
  async get(@Req() req: Request) {
    const session = await getSessionFromRequest(req);
    if (session) {
      return {
        public: await getConfigPublica(),
        all: await getConfigMap(),
      };
    }
    return { public: await getConfigPublica() };
  }

  @Put()
  async put(@Req() req: Request, @Body() body: Record<string, unknown>) {
    await requireUser(req, ["admin"]);
    if (!body || typeof body !== "object") {
      throw new BadRequestException("Datos inválidos");
    }
    const allowed = [
      "marca",
      "eslogan",
      "moneda",
      "canal_remoto_activo",
      "canal_mostrador_activo",
      "telefono_whatsapp",
      "direccion_retiro",
      "plantilla_deadline_horas",
      "checkout_requiere_cuenta",
      "checkout_recomienda_cuenta",
    ];
    for (const [k, v] of Object.entries(body)) {
      if (allowed.includes(k)) await setConfig(k, String(v));
    }
    return {
      public: await getConfigPublica(),
      all: await getConfigMap(),
    };
  }
}
