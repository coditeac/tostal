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
import type { StaffRol } from "../lib/roles";

export const CurrentUser = createParamDecorator(
  async (_data: unknown, ctx: ExecutionContext): Promise<SessionUser> => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const user = await getSessionFromRequest(req);
    if (!user) throw new UnauthorizedException("No autenticado");
    return user;
  }
);

/**
 * @param roles Roles permitidos. "admin" también acepta "superadmin".
 * Superadmin tiene acceso total a cualquier endpoint staff.
 */
export async function requireUser(
  req: Request,
  roles?: StaffRol[]
): Promise<SessionUser> {
  const user = await getSessionFromRequest(req);
  if (!user) throw new UnauthorizedException("No autenticado");
  if (!roles || roles.length === 0) return user;
  if (user.rol === "superadmin") return user;

  const allowed = new Set<string>(roles);
  if (roles.includes("admin")) allowed.add("superadmin");
  if (!allowed.has(user.rol)) {
    throw new ForbiddenException("Sin permiso");
  }
  return user;
}
