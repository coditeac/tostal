import { sqlAll, sqlRun } from "./db";
import { ensureSeed } from "./seed";
import type { ConfiguracionPublica } from "../../../../shared/types";

export async function getConfigMap(): Promise<Record<string, string>> {
  await ensureSeed();
  const rows = await sqlAll<{ clave: string; valor: string }>(
    "SELECT clave, valor FROM configuracion"
  );
  return Object.fromEntries(rows.map((r) => [r.clave, r.valor]));
}

export async function getConfigPublica(): Promise<ConfiguracionPublica> {
  const c = await getConfigMap();
  return {
    marca: c.marca || "Tostal",
    eslogan: c.eslogan || "Sabores que unen culturas",
    moneda: c.moneda || "MXN",
    canalRemotoActivo: c.canal_remoto_activo !== "0",
    canalMostradorActivo: c.canal_mostrador_activo === "1",
    telefonoWhatsApp: c.telefono_whatsapp || null,
    direccionRetiro: c.direccion_retiro || null,
    checkoutRequiereCuenta: c.checkout_requiere_cuenta === "1",
    checkoutRecomiendaCuenta: c.checkout_recomienda_cuenta !== "0",
  };
}

export async function setConfig(clave: string, valor: string) {
  await sqlRun(
    `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
     ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`,
    clave,
    valor
  );
}
