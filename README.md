# Tostal

**Tostal** — *Sabores que unen culturas*

Dos apps web mobile first:

| App | Carpeta | Puerto | Rol |
|---|---|---|---|
| **Restaurant** (API + operación) | `apps/restaurant` | **4321** | Fuente de verdad: DB, auth, menú, inventario, pedidos |
| **Cliente** | `apps/cliente` | **4322** | Consume la API pública (otro agent / UI cliente) |

Base API: `http://127.0.0.1:4321`  
CORS: orígenes en `TOSTAL_CORS_ORIGINS` (por defecto `4322`).

---

## Arranque

```bash
# API + admin (obligatorio primero)
cd apps/restaurant && npm install && npm run dev
# → http://127.0.0.1:4321

# App Cliente (opcional / otro agent)
cd apps/cliente && npm install
# NEXT_PUBLIC_TOSTAL_API_URL=http://127.0.0.1:4321
npm run dev
# → http://127.0.0.1:4322
```

**Demo admin:** `admin@tostal.mx` / `tostal123`  
DB: `apps/restaurant/data/tostal.sqlite` (se crea + seed al primer request).

---

## Contratos API públicos (estables — App Cliente)

Todos bajo `http://127.0.0.1:4321`. Respuestas JSON. Errores: `{ "error": string }` con 4xx.

Tipos TypeScript: `shared/types.ts`.

### `GET /api/public/dias`

Días operativos próximos (abierto + deadline).

**Query (opcional):** `from=YYYY-MM-DD`, `to=YYYY-MM-DD`

```json
{
  "dias": [
    {
      "id": "uuid",
      "fecha": "2026-09-24",
      "abierto": true,
      "deadlinePedido": "2026-09-23T18:00:00.000Z",
      "cupoMaximo": 20,
      "notas": null,
      "deadlineVigente": true
    }
  ],
  "config": {
    "marca": "Tostal",
    "eslogan": "Sabores que unen culturas",
    "moneda": "MXN",
    "canalRemotoActivo": true,
    "canalMostradorActivo": false,
    "telefonoWhatsApp": "52155…",
    "direccionRetiro": "…"
  }
}
```

### `GET /api/public/menu?fecha=YYYY-MM-DD`

Menú del día: solo productos **disponibles** ese día. Si pasó el deadline → `abierto: false` / `deadlineVigente: false`.

```json
{
  "fecha": "2026-09-24",
  "abierto": true,
  "deadlinePedido": "2026-09-23T18:00:00.000Z",
  "deadlineVigente": true,
  "cupoMaximo": 20,
  "categorias": [{ "id": "…", "nombre": "Individuales", "orden": 2, "activa": true }],
  "productos": [
    {
      "id": "…",
      "categoriaId": "…",
      "categoriaNombre": "Individuales",
      "nombre": "Brownie nikkei",
      "descripcion": "…",
      "precio": 6500,
      "activoCatalogo": true,
      "fotoUrl": null,
      "alergenos": "gluten, soja",
      "orden": 3,
      "disponible": true
    }
  ],
  "zonas": [
    { "id": "…", "nombre": "Centro", "cobertura": "…", "costoEnvio": 4500, "activa": true }
  ],
  "config": { "marca": "Tostal", "eslogan": "…", "moneda": "MXN", "canalRemotoActivo": true, "canalMostradorActivo": false }
}
```

**Nota:** `precio` y `costoEnvio` van en **centavos** (MXN × 100).

### `POST /api/public/pedidos`

Crea pedido canal `remoto`. Valida deadline, disponibilidad por día, cupo y zona.

**Body:**

```json
{
  "fechaEntrega": "2026-09-24",
  "modoEntrega": "retiro",
  "zonaId": null,
  "clienteNombre": "Ana",
  "clienteTelefono": "5512345678",
  "direccion": null,
  "metodoPago": "transferencia",
  "notas": null,
  "lineas": [{ "productoId": "…", "cantidad": 2, "notas": null }]
}
```

`modoEntrega`: `retiro` | `envio`  
`metodoPago`: `transferencia` | `contra_entrega` | `stripe`  
Si `envio`: `zonaId` + `direccion` obligatorios.

**201:**

```json
{ "pedido": { "id": "…", "codigo": "T-0923-1234", "estado": "recibido", "estadoPago": "pendiente", "total": 13000, "lineas": [] } }
```

**400** ejemplo: `{ "error": "Ya cerramos pedidos para este día." }`

Sin `STRIPE_SECRET_KEY`, método `stripe` deja `estadoPago: "pagado"` (mock).

### `GET /api/public/pedidos?codigo=T-0923-1234`

Seguimiento por código (o id).

```json
{ "pedido": { "codigo": "T-…", "estado": "recibido", "estadoPago": "pendiente", "lineas": [], "total": 13000 } }
```

Estados pedido: `recibido` → `confirmado` → `en_produccion` → `listo` → `entregado` | `cancelado`.

---

## API internas (App Restaurant, cookie de sesión)

| Método | Ruta | Quién | Uso |
|---|---|---|---|
| POST | `/api/auth/login` | público | `{ email, password }` → cookie |
| GET/POST | `/api/auth/session` | sesión | ver usuario / logout |
| GET/PUT | `/api/config` | admin (PUT) | marca, canales remoto/mostrador |
| GET/POST/PUT | `/api/productos` | staff / admin | CRUD + receta + costo teórico |
| GET/POST/PUT | `/api/insumos` | staff / admin | CRUD insumos |
| GET/PUT | `/api/calendario` | staff / admin | día, deadline, disponibilidad producto×día; `copiarDesde` |
| GET/PATCH | `/api/pedidos` | staff | listar / cambiar estado o pago |
| GET/PATCH | `/api/whatsapp` | staff | cola avisos manuales |
| GET/POST | `/api/inventario` | staff | movimientos, alertas de mínimo |
| GET/POST/PATCH | `/api/compras` | admin | lista sugerida → carrito → entrada stock |
| GET/POST/DELETE | `/api/gastos` | admin | gastos + resumen |
| GET/POST | `/api/produccion` | cocina | cola; **iniciar** descuenta insumos |
| GET | `/api/costos` | staff | márgenes por receta |
| GET/POST | `/api/caja` | caja/admin | turno, pedido mostrador, ficha, vitrina |

### Rutas UI de operación (mobile first)

| Ruta | Módulo |
|---|---|
| `/inventario` | Movimientos, mínimos, alertas |
| `/compras` | Lista sugerida + carrito proveedor |
| `/gastos` | Registro + resumen |
| `/produccion` | Cola cocina (descuento al iniciar) |
| `/costos` | Márgenes por receta |
| `/avisos` | WhatsApp manual (copiar / abrir / marcar) |
| `/caja` | Pedir → pagar → ficha → entregar + vitrina |

Al pasar un pedido a `en_produccion` se **descuentan insumos** según receta.

---

## Ownership multiagente (repo)

- **Restaurant/API/DB/auth/catálogo/calendario/seed:** cimientos (`apps/restaurant`, `shared`, README).
- **Operación (inventario/compras/gastos/producción/caja/avisos):** módulos ops en App Restaurant.
- **UI App Cliente / Stripe checkout UI:** peer agent (`apps/cliente`).

---

## Env

`apps/restaurant/.env.local`:

```bash
TOSTAL_AUTH_SECRET=cambia-en-prod
TOSTAL_CORS_ORIGINS=http://127.0.0.1:4322,http://localhost:4322
# STRIPE_SECRET_KEY=sk_test_…   # opcional; sin clave = mock
```

`apps/cliente/.env.local`:

```bash
NEXT_PUBLIC_TOSTAL_API_URL=http://127.0.0.1:4321
```

## Estructura

```
apps/restaurant   # Next.js — UI operación + Route Handlers + SQLite
apps/cliente      # Next.js — superficie cliente
shared/types.ts   # tipos compartidos
docs/deploy-railway.md
apps/*/railway.toml
```

---

## Deploy (Railway — staging / production)

| Entorno | Branch | Mecanismo |
|---|---|---|
| **Staging** | `main` | Railway Git (environment Staging) |
| **Production** | `production` | Railway Git (environment Production) |

Dos services en el mismo monorepo: `tostal-cliente` (`apps/cliente`) y `tostal-restaurant` (`apps/restaurant`), cada uno con su `railway.toml`.  
**Sin GitHub Actions. Sin Vercel.** Solo integración nativa Railway ↔ Git.

Detalle (env vars, volumen SQLite, setup): [`docs/deploy-railway.md`](docs/deploy-railway.md).

**Repos**

- GitHub: https://github.com/coditeac/tostal *(crear si aún no existe — ver bloqueadores)*
- Origin: https://cursor.com/codebase/coditeac/tostal
- Staging / Production Railway: *pendientes de `RAILWAY_TOKEN` / `railway login` + link del repo*

**Bloqueadores (VM agent)**

1. PAT `coditeac` → `403` en `createRepository` (no puede crear el repo GitHub).
2. Railway CLI `Unauthorized` — no hay `RAILWAY_TOKEN`.
