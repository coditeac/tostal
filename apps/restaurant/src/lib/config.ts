import { getDb } from "./db";
import { ensureSeed } from "./seed";
import type { ConfiguracionPublica } from "../../../../shared/types";

export function getConfigMap(): Record<string, string> {
  ensureSeed();
  const rows = getDb()
    .prepare("SELECT clave, valor FROM configuracion")
    .all() as Array<{ clave: string; valor: string }>;
  return Object.fromEntries(rows.map((r) => [r.clave, r.valor]));
}

export function getConfigPublica(): ConfiguracionPublica {
  const c = getConfigMap();
  return {
    marca: c.marca || "Tostal",
    eslogan: c.eslogan || "Sabores que unen culturas",
    moneda: c.moneda || "MXN",
    canalRemotoActivo: c.canal_remoto_activo !== "0",
    canalMostradorActivo: c.canal_mostrador_activo === "1",
    telefonoWhatsApp: c.telefono_whatsapp || null,
    direccionRetiro: c.direccion_retiro || null,
  };
}

export function setConfig(clave: string, valor: string) {
  getDb()
    .prepare(
      `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
       ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`
    )
    .run(clave, valor);
}
