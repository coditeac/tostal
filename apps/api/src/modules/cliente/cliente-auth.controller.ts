import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  BadRequestException,
  UnauthorizedException,
  HttpCode,
} from "@nestjs/common";
import type { Request, Response } from "express";
import {
  clearClienteCookie,
  getCheckoutPolicy,
  getClienteFromRequest,
  loginCliente,
  registerCliente,
  setClienteCookie,
  signClienteToken,
  updateClientePerfil,
} from "../../lib/cliente-auth";
import { ensureSeed } from "../../lib/seed";
import { mapPedido, getPedido } from "../../lib/pedidos";
import { sqlAll } from "../../lib/db";

@Controller("cliente")
export class ClienteAuthController {
  @Get("policy")
  async policy() {
    await ensureSeed();
    return getCheckoutPolicy();
  }

  @Post("register")
  @HttpCode(201)
  async register(
    @Body()
    body: {
      email?: string;
      password?: string;
      nombre?: string;
      telefono?: string;
    },
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await registerCliente({
      email: String(body.email || ""),
      password: String(body.password || ""),
      nombre: String(body.nombre || ""),
      telefono: body.telefono || null,
    });
    if (!result.ok) throw new BadRequestException(result.error);
    const token = await signClienteToken(result.cliente);
    setClienteCookie(res, token);
    return { user: result.cliente };
  }

  @Post("login")
  @HttpCode(200)
  async login(
    @Body() body: { email?: string; password?: string },
    @Res({ passthrough: true }) res: Response
  ) {
    if (!body?.email || !body?.password) {
      throw new BadRequestException("Email y contraseña son obligatorios.");
    }
    const user = await loginCliente(String(body.email), String(body.password));
    if (!user) throw new UnauthorizedException("Credenciales incorrectas.");
    const token = await signClienteToken(user);
    setClienteCookie(res, token);
    return { user };
  }

  @Post("logout")
  @HttpCode(200)
  async logout(@Res({ passthrough: true }) res: Response) {
    clearClienteCookie(res);
    return { ok: true };
  }

  @Get("me")
  async me(@Req() req: Request) {
    const user = await getClienteFromRequest(req);
    return { user };
  }

  @Patch("me")
  async updateMe(
    @Req() req: Request,
    @Body() body: { nombre?: string; telefono?: string | null }
  ) {
    const user = await getClienteFromRequest(req);
    if (!user) throw new UnauthorizedException("No autenticado");
    const updated = await updateClientePerfil(user.id, body);
    return { user: updated };
  }

  @Get("pedidos")
  async misPedidos(@Req() req: Request) {
    const user = await getClienteFromRequest(req);
    if (!user) throw new UnauthorizedException("No autenticado");
    const rows = await sqlAll<Record<string, unknown>>(
      `SELECT * FROM pedidos WHERE cuenta_cliente_id = ? ORDER BY creado_en DESC LIMIT 50`,
      user.id
    );
    const pedidos = await Promise.all(rows.map((r) => mapPedido(r)));
    return { pedidos };
  }

  @Get("pedidos/:codigo")
  async pedidoDetalle(
    @Req() req: Request,
    @Param("codigo") codigo: string
  ) {
    const user = await getClienteFromRequest(req);
    if (!user) throw new UnauthorizedException("No autenticado");
    const pedido = await getPedido(codigo);
    if (!pedido) throw new BadRequestException("Pedido no encontrado.");
    const rows = await sqlAll<{ codigo: string }>(
      `SELECT codigo FROM pedidos WHERE cuenta_cliente_id = ? AND codigo = ?`,
      user.id,
      codigo
    );
    if (!rows.length) {
      throw new BadRequestException("Pedido no encontrado en tu cuenta.");
    }
    return { pedido };
  }
}
