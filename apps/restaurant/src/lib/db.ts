import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const dataDir = path.join(process.cwd(), "data");
const dbPath = process.env.TOSTAL_DB_PATH || path.join(dataDir, "tostal.sqlite");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  ensureSchema(_db);
  return _db;
}

function ensureSchema(db: Database.Database) {
  db.exec(`
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
  `);

  // Migraciones aditivas seguras (DBs ya sembradas)
  const alters = [
    `ALTER TABLE gastos ADD COLUMN comprobante TEXT`,
    `ALTER TABLE gastos ADD COLUMN compra_id TEXT`,
    `ALTER TABLE turnos_caja ADD COLUMN contador_fichas INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE pedidos ADD COLUMN turno_id TEXT`,
  ];
  for (const sql of alters) {
    try {
      db.exec(sql);
    } catch {
      // columna ya existe
    }
  }
}
