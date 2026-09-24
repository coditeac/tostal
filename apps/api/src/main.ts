import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { isOriginAllowed } from "./common/cors";
import { ApiExceptionFilter } from "./common/http-exception.filter";
import { initDb } from "./lib/db";
import { ensureSeed } from "./lib/seed";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Type"],
  });

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
