import { Controller, Get } from "@nestjs/common";
import { initDb } from "../../lib/db";
import { ensureSeed } from "../../lib/seed";

@Controller()
export class HealthController {
  @Get("health")
  async healthRoot() {
    await initDb();
    await ensureSeed();
    return { ok: true, service: "tostal-api", at: new Date().toISOString() };
  }
}

/** Misma health bajo /api/health (global prefix). */
@Controller("health")
export class ApiHealthController {
  @Get()
  async health() {
    await initDb();
    await ensureSeed();
    return { ok: true, service: "tostal-api", at: new Date().toISOString() };
  }
}
