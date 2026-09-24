import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import {
  getSessionFromRequest,
  type SessionUser,
} from "../lib/auth";

export const CurrentUser = createParamDecorator(
  async (_data: unknown, ctx: ExecutionContext): Promise<SessionUser> => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const user = await getSessionFromRequest(req);
    if (!user) throw new UnauthorizedException("No autenticado");
    return user;
  }
);

export async function requireUser(
  req: Request,
  roles?: SessionUser["rol"][]
): Promise<SessionUser> {
  const user = await getSessionFromRequest(req);
  if (!user) throw new UnauthorizedException("No autenticado");
  if (roles && !roles.includes(user.rol)) {
    throw new ForbiddenException("Sin permiso");
  }
  return user;
}
