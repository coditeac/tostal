import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import type { Request } from "express";
import { AppModule } from "./app.module";
import { isOriginAllowed } from "./common/cors";
import { ApiExceptionFilter } from "./common/http-exception.filter";
import { initDb } from "./lib/db";
import { ensureSeed } from "./lib/seed";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.setGlobalPrefix("api", {
    exclude: ["health"],
  });

  app.use(cookieParser());
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false,
      transform: true,
      forbidUnknownValues: false,
    })
  );

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean | string) => void
    ) => {
      if (!origin || isOriginAllowed(origin)) {
        callback(null, origin || true);
      } else {
        callback(null, origin || true);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Stripe-Signature"],
    exposedHeaders: ["Content-Type"],
  });

  // Exponer rawBody en Request para webhook Stripe
  app.use(
    (
      req: Request & { rawBody?: Buffer },
      _res: unknown,
      next: () => void
    ) => {
      if (
        req.readable &&
        req.url?.includes("/pagos/stripe/webhook") &&
        !req.rawBody
      ) {
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(Buffer.from(c)));
        req.on("end", () => {
          req.rawBody = Buffer.concat(chunks);
          next();
        });
        return;
      }
      next();
    }
  );

  await initDb();
  await ensureSeed();
  const { sqlRun } = await import("./lib/db");
  for (const [k, v] of [
    ["checkout_requiere_cuenta", "0"],
    ["checkout_recomienda_cuenta", "1"],
  ] as const) {
    await sqlRun(
      `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
       ON CONFLICT(clave) DO NOTHING`,
      k,
      v
    );
  }

  const port = Number(process.env.PORT || 4331);
  await app.listen(port, "0.0.0.0");
  console.log(`tostal-api listening on :${port}`);
}

bootstrap();
