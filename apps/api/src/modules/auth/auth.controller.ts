import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import {
  clearSessionCookie,
  getSessionFromRequest,
  login,
  setSessionCookie,
  signSessionToken,
} from "../../lib/auth";
import { ensureSeed } from "../../lib/seed";

@Controller("auth")
export class AuthController {
  @Post("login")
  @HttpCode(200)
  async loginPost(
    @Body() body: { email?: string; password?: string },
    @Res({ passthrough: true }) res: Response
  ) {
    await ensureSeed();
    if (!body?.email || !body?.password) {
      throw new UnauthorizedException("Email y contraseña son obligatorios.");
    }
    const user = await login(String(body.email), String(body.password));
    if (!user) {
      throw new UnauthorizedException("Credenciales incorrectas.");
    }
    const token = await signSessionToken(user);
    setSessionCookie(res, token);
    return { user };
  }

  @Get("session")
  async sessionGet(@Req() req: Request) {
    const user = await getSessionFromRequest(req);
    return { user };
  }

  @Post("session")
  @HttpCode(200)
  async sessionLogout(@Res({ passthrough: true }) res: Response) {
    clearSessionCookie(res);
    return { ok: true };
  }
}
