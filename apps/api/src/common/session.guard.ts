import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { getSessionFromRequest, type SessionUser } from "../lib/auth";

@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const user = await getSessionFromRequest(req);
    if (!user) throw new UnauthorizedException("No autenticado");
    (req as Request & { user?: SessionUser }).user = user;
    return true;
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const user = await getSessionFromRequest(req);
    if (!user) throw new UnauthorizedException("No autenticado");
    if (user.rol !== "admin") throw new ForbiddenException("Sin permiso");
    (req as Request & { user?: SessionUser }).user = user;
    return true;
  }
}
