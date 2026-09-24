import bcrypt from "bcryptjs";
import { sqlGet, sqlRun, sqlTransaction } from "./db";
import { aCentavos, hoyISO, id, sumarDias } from "./utils";

const SEED_FLAG = "seed_version";
const SEED_VERSION = "1";

export async function ensureSeed() {
  const row = await sqlGet<{ valor: string }>(
    "SELECT valor FROM configuracion WHERE clave = ?",
    SEED_FLAG
  );
  if (row?.valor === SEED_VERSION) return;

  const now = new Date().toISOString();
  const adminId = id();
  const hash = bcrypt.hashSync("tostal123", 10);

  await sqlTransaction(async () => {
    // Carrera entre workers de build/prerender: solo uno siembra.
    const again = await sqlGet<{ valor: string }>(
      "SELECT valor FROM configuracion WHERE clave = ?",
      SEED_FLAG
    );
    if (again?.valor === SEED_VERSION) return;

    await sqlRun(
      `INSERT OR IGNORE INTO usuarios (id, email, nombre, rol, password_hash, activo, creado_en)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
      adminId,
      "admin@tostal.mx",
      "Coditeac",
      "admin",
      hash,
      now
    );

    const configs: Record<string, string> = {
      marca: "Tostal",
      eslogan: "Sabores que unen culturas",
      moneda: "MXN",
      canal_remoto_activo: "1",
      canal_mostrador_activo: "0",
      telefono_whatsapp: "5215512345678",
      direccion_retiro: "Av. de los Sabores 12, Ciudad de México",
      plantilla_deadline_horas: "24",
      stripe_mode: "mock",
      [SEED_FLAG]: SEED_VERSION,
    };
    for (const [k, v] of Object.entries(configs)) {
      await sqlRun(
        `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
         ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`,
        k,
        v
      );
    }

    const catTortas = id();
    const catInd = id();
    const catBeb = id();
    await sqlRun(
      `INSERT INTO categorias (id, nombre, orden, activa) VALUES (?, ?, ?, 1)`,
      catTortas,
      "Tortas y pasteles",
      1
    );
    await sqlRun(
      `INSERT INTO categorias (id, nombre, orden, activa) VALUES (?, ?, ?, 1)`,
      catInd,
      "Individuales",
      2
    );
    await sqlRun(
      `INSERT INTO categorias (id, nombre, orden, activa) VALUES (?, ?, ?, 1)`,
      catBeb,
      "Bebidas",
      3
    );

    const insumos = [
      { nombre: "Harina de trigo", unidad: "g", stock: 5000, min: 1000, costo: 0.02 },
      { nombre: "Azúcar", unidad: "g", stock: 3000, min: 800, costo: 0.025 },
      { nombre: "Huevos", unidad: "u", stock: 48, min: 12, costo: 3.5 },
      { nombre: "Mantequilla", unidad: "g", stock: 2000, min: 500, costo: 0.12 },
      { nombre: "Chocolate cobertura", unidad: "g", stock: 1500, min: 400, costo: 0.18 },
      { nombre: "Leche", unidad: "ml", stock: 4000, min: 1000, costo: 0.018 },
      { nombre: "Café", unidad: "g", stock: 800, min: 200, costo: 0.25 },
      { nombre: "Fresas", unidad: "g", stock: 600, min: 200, costo: 0.08 },
    ] as const;

    const insumoIds: Record<string, string> = {};
    for (const i of insumos) {
      const iid = id();
      insumoIds[i.nombre] = iid;
      await sqlRun(
        `INSERT INTO insumos (id, nombre, unidad, stock_actual, stock_minimo, costo_unitario, ubicacion, proveedor_preferido)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        iid,
        i.nombre,
        i.unidad,
        i.stock,
        i.min,
        aCentavos(i.costo),
        i.unidad === "ml" || i.nombre.includes("Fresas") ? "frío" : "despensa",
        "Proveedor Central"
      );
    }

    const productos = [
      {
        cat: catTortas,
        nombre: "Tres leches clásica",
        desc: "Bizcocho esponjoso bañado en tres leches, con canela.",
        precio: 420,
        alergenos: "lácteos, gluten, huevo",
        foto: null,
      },
      {
        cat: catTortas,
        nombre: "Chocolate mestizo",
        desc: "Capas de chocolate y ganache con toque de chile guajillo.",
        precio: 480,
        alergenos: "lácteos, gluten, huevo",
        foto: null,
      },
      {
        cat: catInd,
        nombre: "Brownie nikkei",
        desc: "Brownie denso con miso dulce y ajonjolí.",
        precio: 65,
        alergenos: "gluten, soja, sésamo",
        foto: null,
      },
      {
        cat: catInd,
        nombre: "Cheesecake de guava",
        desc: "Base de galleta, crema y coulis de guava.",
        precio: 75,
        alergenos: "lácteos, gluten",
        foto: null,
      },
      {
        cat: catInd,
        nombre: "Alfajor Tostal",
        desc: "Doble galleta con dulce de leche y coco.",
        precio: 45,
        alergenos: "lácteos, gluten",
        foto: null,
      },
      {
        cat: catBeb,
        nombre: "Café de olla frío",
        desc: "Café con piloncillo y canela, servido con hielo.",
        precio: 55,
        alergenos: null,
        foto: null,
      },
      {
        cat: catBeb,
        nombre: "Chocolate espumoso",
        desc: "Chocolate caliente batido al estilo tradicional.",
        precio: 60,
        alergenos: "lácteos",
        foto: null,
      },
    ] as const;

    const prodIds: string[] = [];
    for (let idx = 0; idx < productos.length; idx++) {
      const p = productos[idx];
      const pid = id();
      prodIds.push(pid);
      await sqlRun(
        `INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, activo_catalogo, foto_url, alergenos, orden)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
        pid,
        p.cat,
        p.nombre,
        p.desc,
        aCentavos(p.precio),
        p.foto,
        p.alergenos,
        idx + 1
      );
    }

    const recetas: Array<[number, string, number]> = [
      [0, "Harina de trigo", 400],
      [0, "Azúcar", 200],
      [0, "Huevos", 4],
      [0, "Leche", 500],
      [1, "Harina de trigo", 350],
      [1, "Chocolate cobertura", 300],
      [1, "Huevos", 5],
      [1, "Mantequilla", 200],
      [2, "Harina de trigo", 80],
      [2, "Chocolate cobertura", 60],
      [2, "Huevos", 1],
      [2, "Mantequilla", 40],
      [3, "Huevos", 1],
      [3, "Azúcar", 50],
      [3, "Leche", 80],
      [4, "Harina de trigo", 40],
      [4, "Azúcar", 20],
      [4, "Mantequilla", 25],
      [5, "Café", 18],
      [5, "Azúcar", 15],
      [6, "Chocolate cobertura", 40],
      [6, "Leche", 200],
    ];
    for (const [pi, nombre, cant] of recetas) {
      await sqlRun(
        `INSERT INTO receta_lineas (id, producto_id, insumo_id, cantidad) VALUES (?, ?, ?, ?)`,
        id(),
        prodIds[pi],
        insumoIds[nombre],
        cant
      );
    }

    const zona1 = id();
    const zona2 = id();
    await sqlRun(
      `INSERT INTO zonas_envio (id, nombre, cobertura, costo_envio, activa) VALUES (?, ?, ?, ?, 1)`,
      zona1,
      "Centro",
      "Colonias del centro y Roma/Condesa",
      aCentavos(45)
    );
    await sqlRun(
      `INSERT INTO zonas_envio (id, nombre, cobertura, costo_envio, activa) VALUES (?, ?, ?, ?, 1)`,
      zona2,
      "Sur cercano",
      "Coyoacán y alrededores",
      aCentavos(65)
    );

    const hoy = hoyISO();

    for (let i = 0; i < 14; i++) {
      const fecha = sumarDias(hoy, i);
      // Deadline: día anterior a las 18:00 (o hoy-1h si es hoy)
      const deadlineDate = new Date(`${fecha}T18:00:00`);
      deadlineDate.setDate(deadlineDate.getDate() - 1);
      if (i === 0) {
        // para hoy: deadline en 6 horas desde ahora para demos
        const d = new Date();
        d.setHours(d.getHours() + 6);
        await sqlRun(
          `INSERT OR IGNORE INTO dias_operativos (id, fecha, abierto, deadline_pedido, cupo_maximo, notas)
           VALUES (?, ?, 1, ?, ?, ?)`,
          id(),
          fecha,
          d.toISOString(),
          20,
          "Día de demostración"
        );
      } else {
        await sqlRun(
          `INSERT OR IGNORE INTO dias_operativos (id, fecha, abierto, deadline_pedido, cupo_maximo, notas)
           VALUES (?, ?, 1, ?, ?, ?)`,
          id(),
          fecha,
          deadlineDate.toISOString(),
          20,
          null
        );
      }
      for (const pid of prodIds) {
        // El café solo algunos días
        const esCafe = pid === prodIds[5] || pid === prodIds[6];
        const disponible = !esCafe || i % 2 === 0 ? 1 : 0;
        await sqlRun(
          `INSERT OR IGNORE INTO disponibilidad_producto_dia (id, fecha, producto_id, disponible)
           VALUES (?, ?, ?, ?)`,
          id(),
          fecha,
          pid,
          disponible
        );
      }
    }
  });
}
