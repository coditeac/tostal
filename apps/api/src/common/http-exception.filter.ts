import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Response } from "express";

/** Respuestas compatibles con fronts: { error: string } */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Error interno";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "string") message = body;
      else if (body && typeof body === "object") {
        const m = (body as { message?: string | string[] }).message;
        message = Array.isArray(m) ? m.join(", ") : m || exception.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    res.status(status).json({ error: message });
  }
}
