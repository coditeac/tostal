/**
 * Capa de datos Tostal.
 * - Producción (Railway): Postgres vía DATABASE_URL (servicio visible).
 * - Local: SQLite (better-sqlite3 opcional) en TOSTAL_DB_PATH o ./data/tostal.sqlite.
 */
import fs from "fs";
import path from "path";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

export type Dialect = "sqlite" | "postgres";

export function getDialect(): Dialect {
  return process.env.DATABASE_URL ? "postgres" : "sqlite";
}

export function isPostgres(): boolean {
  return getDialect() === "postgres";
}

/* ---------- SQLite (opcional; no se instala en Railway) ---------- */

type SqliteDb = {
  prepare: (sql: string) => {
    all: (...params: unknown[]) => unknown[];
    get: (...params: unknown[]) => unknown;
    run: (...params: unknown[]) => { changes: number };
  };
  pragma: (s: string) => void;
  exec: (sql: string) => void;
};

function resolveDbPath(): string {
  const preferred =
    process.env.TOSTAL_DB_PATH ||
    path.join(process.cwd(), "data", "tostal.sqlite");
  const dir = path.dirname(preferred);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return preferred;
  } catch {
    const fallback = path.join("/tmp", "tostal-build.sqlite");
    fs.mkdirSync(path.dirname(fallback), { recursive: true });
    return fallback;
  }
}

let _sqlite: SqliteDb | null = null;

function getSqlite(): SqliteDb {
  if (_sqlite) return _sqlite;
  // require dinámico: better-sqlite3 es optionalDependency
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3") as new (path: string) => SqliteDb;
  _sqlite = new Database(resolveDbPath());
  _sqlite.pragma("journal_mode = WAL");
  _sqlite.pragma("foreign_keys = ON");
  return _sqlite;
}

/* ---------- Postgres ---------- */

let _pool: Pool | null = null;
let _schemaReady = false;
let _txClient: PoolClient | null = null;

function getPool(): Pool {
  if (_pool) return _pool;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no configurada");
  _pool = new Pool({
    connectionString: url,
    // Railway private network usa SSL a veces; permitir ambos
    ssl: process.env.DATABASE_SSL === "require" ? { rejectUnauthorized: false } : undefined,
    max: 10,
  });
  return _pool;
}

/** Convierte SQL estilo SQLite (? / INSERT OR IGNORE) a Postgres. */
export function toPostgresSql(sql: string): string {
  let s = sql.trim();
  if (/^INSERT\s+OR\s+IGNORE\s+INTO/i.test(s)) {
    s = s.replace(/^INSERT\s+OR\s+IGNORE\s+INTO/i, "INSERT INTO");
    if (!/\bON\s+CONFLICT\b/i.test(s)) {
      s = `${s} ON CONFLICT DO NOTHING`;
    }
  }
  // Postgres lowercasing: preservar alias camelCase → "productoId"
  s = s.replace(/\bas\s+([A-Za-z_][A-Za-z0-9_]*)/g, (full, alias: string) => {
    if (alias !== alias.toLowerCase() && !alias.startsWith('"')) {
      return `as "${alias}"`;
    }
    return full;
  });
  // COUNT(*) en pg llega como string (int8); forzar int4
  s = s.replace(/COUNT\(\*\)/gi, "COUNT(*)::int");
  let i = 0;
  s = s.replace(/\?/g, () => `$${++i}`);
  return s;
}

async function pgQuery<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<{ rows: T[]; rowCount: number }> {
  const text = toPostgresSql(sql);
  const client = _txClient || getPool();
  const res = await client.query<T>(text, params);
  return { rows: res.rows, rowCount: res.rowCount ?? 0 };
}

/* ---------- API unificada async ---------- */

export async function sqlAll<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  ...params: unknown[]
): Promise<T[]> {
  await ensureReady();
  if (isPostgres()) {
    const { rows } = await pgQuery<T>(sql, params);
    return rows;
  }
  return getSqlite().prepare(sql).all(...params) as T[];
}

export async function sqlGet<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  ...params: unknown[]
): Promise<T | undefined> {
  await ensureReady();
  if (isPostgres()) {
    const { rows } = await pgQuery<T>(sql, params);
    return rows[0];
  }
  return getSqlite().prepare(sql).get(...params) as T | undefined;
}

export async function sqlRun(
  sql: string,
  ...params: unknown[]
): Promise<{ changes: number }> {
  await ensureReady();
  if (isPostgres()) {
    const { rowCount } = await pgQuery(sql, params);
    return { changes: rowCount };
  }
  const info = getSqlite().prepare(sql).run(...params);
  return { changes: info.changes };
}

export async function sqlExec(sql: string): Promise<void> {
  await ensureReady();
  if (isPostgres()) {
    const client = _txClient || getPool();
    await client.query(sql);
    return;
  }
  getSqlite().exec(sql);
}

export async function sqlTransaction<T>(fn: () => Promise<T>): Promise<T> {
  await ensureReady();
  if (!isPostgres()) {
    const db = getSqlite();
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = await fn();
      db.exec("COMMIT");
      return result;
    } catch (e) {
      try {
        db.exec("ROLLBACK");
      } catch {
        /* ignore */
      }
      throw e;
    }
  }

  const pool = getPool();
  const client = await pool.connect();
  const prev = _txClient;
  _txClient = client;
  try {
    await client.query("BEGIN");
    const result = await fn();
    await client.query("COMMIT");
    return result;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    _txClient = prev;
    client.release();
  }
}

async function ensureReady(): Promise<void> {
  if (_schemaReady) return;
  if (isPostgres()) {
    await ensureSchemaPostgres();
  } else {
    ensureSchemaSqlite(getSqlite());
  }
  _schemaReady = true;
}

/** Fuerza init (schema) — llamar al boot de API. */
export async function initDb(): Promise<void> {
  await ensureReady();
}

/**
 * Compat legado: solo SQLite sync.
 * No usar en código nuevo; preferir sqlAll/sqlGet/sqlRun.
 */
export function getDb(): SqliteDb {
  if (isPostgres()) {
    throw new Error(
      "getDb() sync no disponible con Postgres. Usa sqlAll/sqlGet/sqlRun."
    );
  }
  ensureSchemaSqlite(getSqlite());
  _schemaReady = true;
  return getSqlite();
}

const SCHEMA_SQLITE = `
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      rol TEXT NOT NULL CHECK(rol IN ('admin','cocina','caja')),
      password_hash TEXT NOT NULL,
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categorias (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      orden INTEGER NOT NULL DEFAULT 0,
      activa INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS productos (
      id TEXT PRIMARY KEY,
      categoria_id TEXT REFERENCES categorias(id) ON DELETE SET NULL,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      precio INTEGER NOT NULL,
      activo_catalogo INTEGER NOT NULL DEFAULT 1,
      foto_url TEXT,
      alergenos TEXT,
      orden INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS insumos (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      unidad TEXT NOT NULL CHECK(unidad IN ('g','ml','u')),
      stock_actual REAL NOT NULL DEFAULT 0,
      stock_minimo REAL NOT NULL DEFAULT 0,
      costo_unitario INTEGER NOT NULL DEFAULT 0,
      ubicacion TEXT,
      proveedor_preferido TEXT
    );

    CREATE TABLE IF NOT EXISTS receta_lineas (
      id TEXT PRIMARY KEY,
      producto_id TEXT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
      insumo_id TEXT NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
      cantidad REAL NOT NULL,
      UNIQUE(producto_id, insumo_id)
    );

    CREATE TABLE IF NOT EXISTS dias_operativos (
      id TEXT PRIMARY KEY,
      fecha TEXT NOT NULL UNIQUE,
      abierto INTEGER NOT NULL DEFAULT 1,
      deadline_pedido TEXT NOT NULL,
      cupo_maximo INTEGER,
      notas TEXT
    );

    CREATE TABLE IF NOT EXISTS disponibilidad_producto_dia (
      id TEXT PRIMARY KEY,
      fecha TEXT NOT NULL,
      producto_id TEXT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
      disponible INTEGER NOT NULL DEFAULT 1,
      UNIQUE(fecha, producto_id)
    );

    CREATE TABLE IF NOT EXISTS zonas_envio (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      cobertura TEXT,
      costo_envio INTEGER NOT NULL DEFAULT 0,
      activa INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      telefono TEXT NOT NULL,
      email TEXT,
      notas TEXT,
      creado_en TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pedidos (
      id TEXT PRIMARY KEY,
      codigo TEXT NOT NULL UNIQUE,
      canal TEXT NOT NULL CHECK(canal IN ('remoto','mostrador')),
      estado TEXT NOT NULL,
      estado_pago TEXT NOT NULL,
      metodo_pago TEXT NOT NULL,
      modo_entrega TEXT NOT NULL CHECK(modo_entrega IN ('retiro','envio')),
      fecha_entrega TEXT NOT NULL,
      zona_id TEXT REFERENCES zonas_envio(id),
      cliente_id TEXT REFERENCES clientes(id),
      cliente_nombre TEXT NOT NULL,
      cliente_telefono TEXT NOT NULL,
      direccion TEXT,
      subtotal INTEGER NOT NULL,
      costo_envio INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL,
      notas TEXT,
      insumos_descontados INTEGER NOT NULL DEFAULT 0,
      ficha_codigo TEXT,
      creado_en TEXT NOT NULL,
      actualizado_en TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pedido_lineas (
      id TEXT PRIMARY KEY,
      pedido_id TEXT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
      producto_id TEXT NOT NULL REFERENCES productos(id),
      producto_nombre TEXT NOT NULL,
      cantidad INTEGER NOT NULL,
      precio_unitario INTEGER NOT NULL,
      subtotal INTEGER NOT NULL,
      notas TEXT
    );

    CREATE TABLE IF NOT EXISTS movimientos_inventario (
      id TEXT PRIMARY KEY,
      insumo_id TEXT NOT NULL REFERENCES insumos(id),
      tipo TEXT NOT NULL,
      cantidad REAL NOT NULL,
      costo_unitario INTEGER,
      motivo TEXT,
      pedido_id TEXT REFERENCES pedidos(id),
      usuario_id TEXT,
      creado_en TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS avisos_whatsapp (
      id TEXT PRIMARY KEY,
      pedido_id TEXT REFERENCES pedidos(id),
      destinatario TEXT NOT NULL,
      telefono TEXT NOT NULL,
      evento TEXT NOT NULL,
      texto TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      creado_en TEXT NOT NULL,
      enviado_en TEXT
    );

    CREATE TABLE IF NOT EXISTS gastos (
      id TEXT PRIMARY KEY,
      categoria TEXT NOT NULL,
      monto INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      metodo_pago TEXT,
      notas TEXT,
      creado_en TEXT NOT NULL,
      comprobante TEXT,
      compra_id TEXT
    );

    CREATE TABLE IF NOT EXISTS vitrina_stock (
      producto_id TEXT PRIMARY KEY REFERENCES productos(id) ON DELETE CASCADE,
      cantidad INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS turnos_caja (
      id TEXT PRIMARY KEY,
      abierto_en TEXT NOT NULL,
      cerrado_en TEXT,
      usuario_id TEXT,
      total_efectivo INTEGER DEFAULT 0,
      total_otros INTEGER DEFAULT 0,
      notas TEXT,
      contador_fichas INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS proveedores (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      notas TEXT,
      preferido INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS listas_compra (
      id TEXT PRIMARY KEY,
      estado TEXT NOT NULL DEFAULT 'borrador',
      creado_en TEXT NOT NULL,
      notas TEXT
    );

    CREATE TABLE IF NOT EXISTS lista_compra_items (
      id TEXT PRIMARY KEY,
      lista_id TEXT NOT NULL REFERENCES listas_compra(id) ON DELETE CASCADE,
      insumo_id TEXT NOT NULL REFERENCES insumos(id),
      cantidad_sugerida REAL NOT NULL,
      cantidad REAL NOT NULL,
      proveedor TEXT,
      motivo TEXT
    );

    CREATE TABLE IF NOT EXISTS carritos_compra (
      id TEXT PRIMARY KEY,
      proveedor TEXT,
      estado TEXT NOT NULL DEFAULT 'borrador',
      creado_en TEXT NOT NULL,
      comprado_en TEXT,
      notas TEXT,
      total INTEGER DEFAULT 0,
      lista_id TEXT REFERENCES listas_compra(id)
    );

    CREATE TABLE IF NOT EXISTS carrito_compra_lineas (
      id TEXT PRIMARY KEY,
      carrito_id TEXT NOT NULL REFERENCES carritos_compra(id) ON DELETE CASCADE,
      insumo_id TEXT NOT NULL REFERENCES insumos(id),
      cantidad REAL NOT NULL,
      costo_unitario INTEGER NOT NULL DEFAULT 0,
      comprada INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS vitrina_movimientos (
      id TEXT PRIMARY KEY,
      producto_id TEXT NOT NULL REFERENCES productos(id),
      tipo TEXT NOT NULL,
      cantidad INTEGER NOT NULL,
      pedido_id TEXT,
      motivo TEXT,
      creado_en TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cuentas_cliente (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      nombre TEXT NOT NULL,
      telefono TEXT,
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS email_log (
      id TEXT PRIMARY KEY,
      pedido_id TEXT,
      destinatario TEXT NOT NULL,
      evento TEXT NOT NULL,
      asunto TEXT NOT NULL,
      estado TEXT NOT NULL,
      error TEXT,
      creado_en TEXT NOT NULL
    );
`;

const SCHEMA_ALTERS_SQLITE = [
  `ALTER TABLE gastos ADD COLUMN comprobante TEXT`,
  `ALTER TABLE gastos ADD COLUMN compra_id TEXT`,
  `ALTER TABLE turnos_caja ADD COLUMN contador_fichas INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE pedidos ADD COLUMN turno_id TEXT`,
  `ALTER TABLE pedidos ADD COLUMN cuenta_cliente_id TEXT`,
  `ALTER TABLE pedidos ADD COLUMN cliente_email TEXT`,
  `ALTER TABLE pedidos ADD COLUMN stripe_payment_intent_id TEXT`,
  `ALTER TABLE productos ADD COLUMN duraciones TEXT`,
];

const SCHEMA_ALTERS_PG = [
  `ALTER TABLE gastos ADD COLUMN IF NOT EXISTS comprobante TEXT`,
  `ALTER TABLE gastos ADD COLUMN IF NOT EXISTS compra_id TEXT`,
  `ALTER TABLE turnos_caja ADD COLUMN IF NOT EXISTS contador_fichas INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS turno_id TEXT`,
  `ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cuenta_cliente_id TEXT`,
  `ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_email TEXT`,
  `ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT`,
  `ALTER TABLE productos ADD COLUMN IF NOT EXISTS duraciones TEXT`,
  `CREATE TABLE IF NOT EXISTS cuentas_cliente (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      nombre TEXT NOT NULL,
      telefono TEXT,
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL
    )`,
  `CREATE TABLE IF NOT EXISTS email_log (
      id TEXT PRIMARY KEY,
      pedido_id TEXT,
      destinatario TEXT NOT NULL,
      evento TEXT NOT NULL,
      asunto TEXT NOT NULL,
      estado TEXT NOT NULL,
      error TEXT,
      creado_en TEXT NOT NULL
    )`,
];

function ensureSchemaSqlite(db: SqliteDb) {
  db.exec(SCHEMA_SQLITE);
  for (const sql of SCHEMA_ALTERS_SQLITE) {
    try {
      db.exec(sql);
    } catch {
      // columna ya existe
    }
  }
}

async function ensureSchemaPostgres() {
  const pool = getPool();
  // Varias sentencias DDL; el driver pg las acepta en una query simple.
  await pool.query(SCHEMA_SQLITE);
  for (const sql of SCHEMA_ALTERS_PG) {
    await pool.query(sql);
  }
}
