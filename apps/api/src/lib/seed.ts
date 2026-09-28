/**
 * Bootstrap de arranque (sin catálogo demo).
 * - Config mínima de marca.
 * - Superadmin desde SUPERADMIN_EMAIL + SUPERADMIN_PASSWORD (one-shot / upsert controlado).
 * - Purga idempotente de datos demo legados.
 */
import bcrypt from "bcryptjs";
import { sqlGet, sqlRun, sqlAll, sqlTransaction } from "./db";
import { id } from "./id";

const BOOTSTRAP_FLAG = "bootstrap_version";
const BOOTSTRAP_VERSION = "2";
const DEMO_PURGE_FLAG = "demo_purged_v1";

const DEMO_PRODUCT_NAMES = [
  "Tres leches clásica",
  "Chocolate mestizo",
  "Brownie nikkei",
  "Cheesecake de guava",
  "Alfajor Tostal",
  "Café de olla frío",
  "Chocolate espumoso",
] as const;

const DEMO_CATEGORY_NAMES = [
  "Tortas y pasteles",
  "Individuales",
  "Bebidas",
] as const;

const DEMO_INSUMO_NAMES = [
  "Harina de trigo",
  "Azúcar",
  "Huevos",
  "Mantequilla",
  "Chocolate cobertura",
  "Leche",
  "Café",
  "Fresas",
] as const;

const DEMO_ZONA_NAMES = ["Centro", "Sur cercano"] as const;
const DEMO_ADMIN_EMAIL = "admin@tostal.mx";

/** Compat: callers históricos siguen usando ensureSeed(). */
export async function ensureSeed() {
  await ensureBootstrap();
}

export async function ensureBootstrap() {
  await ensureMinimalConfig();
  await ensureSuperadminFromEnv();
  await purgeDemoDataOnce();

  const row = await sqlGet<{ valor: string }>(
    "SELECT valor FROM configuracion WHERE clave = ?",
    BOOTSTRAP_FLAG
  );
  if (row?.valor === BOOTSTRAP_VERSION) return;

  await sqlRun(
    `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
     ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`,
    BOOTSTRAP_FLAG,
    BOOTSTRAP_VERSION
  );
}

async function ensureMinimalConfig() {
  const configs: Record<string, string> = {
    marca: "Tostal",
    eslogan: "Sabores que unen culturas",
    moneda: "MXN",
    canal_remoto_activo: "1",
    canal_mostrador_activo: "0",
    plantilla_deadline_horas: "24",
    stripe_mode: "mock",
    checkout_requiere_cuenta: "0",
    checkout_recomienda_cuenta: "1",
  };
  for (const [k, v] of Object.entries(configs)) {
    await sqlRun(
      `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
       ON CONFLICT(clave) DO NOTHING`,
      k,
      v
    );
  }
}

/**
 * Crea el superadmin inicial desde env.
 * - Requiere SUPERADMIN_EMAIL + SUPERADMIN_PASSWORD.
 * - Si no hay ningún superadmin → crea con ese email/password.
 * - Si SUPERADMIN_FORCE_RESET=1 → actualiza password (y nombre) del email indicado,
 *   o crea si no existe. Útil para rotar credenciales en Railway.
 */
export async function ensureSuperadminFromEnv() {
  const email = (process.env.SUPERADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD || "";
  const force = process.env.SUPERADMIN_FORCE_RESET === "1";

  if (!email || !password) {
    const any = await sqlGet<{ id: string }>(
      `SELECT id FROM usuarios WHERE rol = 'superadmin' AND activo = 1 LIMIT 1`
    );
    if (!any) {
      console.warn(
        "[bootstrap] Sin SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD y no hay superadmin. " +
          "Define esas vars en Railway y redespliega (o setea SUPERADMIN_FORCE_RESET=1)."
      );
    }
    return;
  }

  if (password.length < 8) {
    console.error(
      "[bootstrap] SUPERADMIN_PASSWORD debe tener al menos 8 caracteres. No se creó/actualizó."
    );
    return;
  }

  const existingSuper = await sqlGet<{ id: string; email: string }>(
    `SELECT id, email FROM usuarios WHERE rol = 'superadmin' LIMIT 1`
  );
  const byEmail = await sqlGet<{
    id: string;
    email: string;
    rol: string;
  }>(`SELECT id, email, rol FROM usuarios WHERE email = ?`, email);

  const hash = await bcrypt.hash(password, 10);
  const nombre =
    (process.env.SUPERADMIN_NOMBRE || "").trim() || "Superadmin Tostal";
  const now = new Date().toISOString();

  if (byEmail) {
    if (force || byEmail.rol !== "superadmin" || !existingSuper) {
      await sqlRun(
        `UPDATE usuarios SET nombre = ?, rol = 'superadmin', password_hash = ?, activo = 1 WHERE id = ?`,
        nombre,
        hash,
        byEmail.id
      );
      console.info(
        `[bootstrap] Superadmin actualizado: ${email}${force ? " (FORCE_RESET)" : ""}`
      );
    }
    return;
  }

  if (existingSuper && !force) {
    // Ya hay un superadmin distinto; no crear otro sin force.
    console.info(
      `[bootstrap] Ya existe superadmin (${existingSuper.email}). ` +
        `Para forzar con SUPERADMIN_EMAIL=${email}, setea SUPERADMIN_FORCE_RESET=1.`
    );
    return;
  }

  if (existingSuper && force && existingSuper.email !== email) {
    // Promueve el nuevo email y deja el anterior como admin (sin borrar).
    await sqlRun(
      `UPDATE usuarios SET rol = 'admin' WHERE id = ?`,
      existingSuper.id
    );
  }

  await sqlRun(
    `INSERT INTO usuarios (id, email, nombre, rol, password_hash, activo, creado_en)
     VALUES (?, ?, ?, 'superadmin', ?, 1, ?)`,
    id(),
    email,
    nombre,
    hash,
    now
  );
  console.info(`[bootstrap] Superadmin creado: ${email}`);
}

/**
 * One-shot idempotente: elimina catálogo/usuario demo del seed v1.
 * No toca pedidos reales; productos referenciados solo se desactivan.
 */
export async function purgeDemoDataOnce() {
  const flag = await sqlGet<{ valor: string }>(
    "SELECT valor FROM configuracion WHERE clave = ?",
    DEMO_PURGE_FLAG
  );
  if (flag?.valor === "1") return;

  await sqlTransaction(async () => {
    const again = await sqlGet<{ valor: string }>(
      "SELECT valor FROM configuracion WHERE clave = ?",
      DEMO_PURGE_FLAG
    );
    if (again?.valor === "1") return;

    await sqlRun(`DELETE FROM usuarios WHERE email = ?`, DEMO_ADMIN_EMAIL);

    // Quitar placeholders obvios de demo
    await sqlRun(
      `DELETE FROM configuracion WHERE clave = 'telefono_whatsapp' AND valor = ?`,
      "5215512345678"
    );
    await sqlRun(
      `DELETE FROM configuracion WHERE clave = 'direccion_retiro' AND valor = ?`,
      "Av. de los Sabores 12, Ciudad de México"
    );
    await sqlRun(
      `DELETE FROM dias_operativos WHERE notas = ?`,
      "Día de demostración"
    );

    const productPlaceholders = DEMO_PRODUCT_NAMES.map(() => "?").join(",");
    const demoProducts = await sqlAll<{ id: string }>(
      `SELECT id FROM productos WHERE nombre IN (${productPlaceholders})`,
      ...DEMO_PRODUCT_NAMES
    );
    const productIds = demoProducts.map((p) => p.id);

    if (productIds.length) {
      const ph = productIds.map(() => "?").join(",");
      await sqlRun(
        `DELETE FROM disponibilidad_producto_dia WHERE producto_id IN (${ph})`,
        ...productIds
      );
      await sqlRun(
        `DELETE FROM receta_lineas WHERE producto_id IN (${ph})`,
        ...productIds
      );
      try {
        await sqlRun(
          `DELETE FROM vitrina_stock WHERE producto_id IN (${ph})`,
          ...productIds
        );
      } catch {
        /* tabla puede no existir en installs viejos */
      }
      try {
        await sqlRun(
          `DELETE FROM vitrina_movimientos WHERE producto_id IN (${ph})`,
          ...productIds
        );
      } catch {
        /* ignore */
      }

      // Productos sin líneas de pedido → borrar; con pedidos → desactivar
      for (const pid of productIds) {
        const used = await sqlGet<{ c: number }>(
          `SELECT COUNT(*) as c FROM pedido_lineas WHERE producto_id = ?`,
          pid
        );
        if (Number(used?.c || 0) > 0) {
          await sqlRun(
            `UPDATE productos SET activo_catalogo = 0 WHERE id = ?`,
            pid
          );
        } else {
          await sqlRun(`DELETE FROM productos WHERE id = ?`, pid);
        }
      }
    }

    const catPh = DEMO_CATEGORY_NAMES.map(() => "?").join(",");
    const cats = await sqlAll<{ id: string }>(
      `SELECT id FROM categorias WHERE nombre IN (${catPh})`,
      ...DEMO_CATEGORY_NAMES
    );
    for (const c of cats) {
      const left = await sqlGet<{ c: number }>(
        `SELECT COUNT(*) as c FROM productos WHERE categoria_id = ?`,
        c.id
      );
      if (!Number(left?.c || 0)) {
        await sqlRun(`DELETE FROM categorias WHERE id = ?`, c.id);
      }
    }

    const insumoPh = DEMO_INSUMO_NAMES.map(() => "?").join(",");
    const insumos = await sqlAll<{ id: string }>(
      `SELECT id FROM insumos WHERE nombre IN (${insumoPh})`,
      ...DEMO_INSUMO_NAMES
    );
    for (const i of insumos) {
      const used = await sqlGet<{ c: number }>(
        `SELECT COUNT(*) as c FROM receta_lineas WHERE insumo_id = ?`,
        i.id
      );
      const mov = await sqlGet<{ c: number }>(
        `SELECT COUNT(*) as c FROM movimientos_inventario WHERE insumo_id = ?`,
        i.id
      );
      if (!Number(used?.c || 0) && !Number(mov?.c || 0)) {
        await sqlRun(`DELETE FROM insumos WHERE id = ?`, i.id);
      }
    }

    const zonaPh = DEMO_ZONA_NAMES.map(() => "?").join(",");
    const zonas = await sqlAll<{ id: string }>(
      `SELECT id FROM zonas_envio WHERE nombre IN (${zonaPh})`,
      ...DEMO_ZONA_NAMES
    );
    for (const z of zonas) {
      const used = await sqlGet<{ c: number }>(
        `SELECT COUNT(*) as c FROM pedidos WHERE zona_id = ?`,
        z.id
      );
      if (!Number(used?.c || 0)) {
        await sqlRun(`DELETE FROM zonas_envio WHERE id = ?`, z.id);
      } else {
        await sqlRun(`UPDATE zonas_envio SET activa = 0 WHERE id = ?`, z.id);
      }
    }

    // Flag del seed viejo ya no aplica como "completo"
    await sqlRun(`DELETE FROM configuracion WHERE clave = ?`, "seed_version");

    await sqlRun(
      `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
       ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`,
      DEMO_PURGE_FLAG,
      "1"
    );
  });

  console.info("[bootstrap] Purga demo v1 aplicada (idempotente).");
}
