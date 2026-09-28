import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  BadRequestException,
  HttpCode,
} from "@nestjs/common";
import type { Request } from "express";
import { requireUser } from "../../common/session.decorator";
import { createStaff, listStaff, updateStaff } from "../../lib/staff";
import type { SessionUser } from "../../lib/auth";

@Controller("usuarios")
export class UsuariosController {
  @Get()
  async list(@Req() req: Request) {
    await requireUser(req, ["admin"]);
    return { usuarios: await listStaff() };
  }

  @Post()
  @HttpCode(201)
  async create(
    @Req() req: Request,
    @Body()
    body: {
      email?: string;
      nombre?: string;
      password?: string;
      rol?: SessionUser["rol"];
    }
  ) {
    const actor = await requireUser(req, ["admin"]);
    const result = await createStaff({
      email: String(body.email || ""),
      nombre: String(body.nombre || ""),
      password: String(body.password || ""),
      rol: (body.rol || "caja") as SessionUser["rol"],
      actorRol: actor.rol,
    });
    if (!result.ok) throw new BadRequestException(result.error);
    return { user: result.user };
  }

  @Patch()
  async update(
    @Req() req: Request,
    @Body()
    body: {
      id?: string;
      nombre?: string;
      rol?: SessionUser["rol"];
      activo?: boolean;
      password?: string;
    }
  ) {
    const actor = await requireUser(req, ["admin"]);
    if (!body?.id) throw new BadRequestException("Falta id.");
    const result = await updateStaff(String(body.id), {
      nombre: body.nombre,
      rol: body.rol,
      activo: body.activo,
      password: body.password,
      actorRol: actor.rol,
    });
    if (!result.ok) throw new BadRequestException(result.error);
    return { user: result.user };
  }
}
