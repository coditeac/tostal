# Brief de dirección visual — Tostal

**Marca:** Tostal · *Sabores que unen culturas*  
**Apps:** Cliente (pedir) · Restaurant (operar)  
**Owner visual:** Coditeac · auditoría Mobbin 2026-09-28 · **shadcn/ui** · mobile first · español  
**Doc auditoría:** `docs/auditoria-ui-restaurantes.md`

---

## 1. Identidad oficial (obligatoria)

### Logo

Wordmark tipográfico **solo** (TOSTAL + eslogan) sobre **fondo transparente**. El rojo **no** es parte del PNG.

| Asset | Uso |
|---|---|
| `tostal-logo.png` / cream | Wordmark crema `#D6D2C4` → fondos marca `#9A2E25` |
| `tostal-logo-marca.png` | Wordmark rojo `#9A2E25` → fondos claros |
| `tostal-logo-ink.png` | Wordmark ink → alt. papel |
| `tostal-logo-on-marca.png` | Histórico — **no usar en UI** |

### Color primario (único)

| Token | Valor | Uso |
|---|---|---|
| Rojo marca | **`#9A2E25`** | Hero, CTAs, chips activos, focus, login ops |
| Crema logo | **`#D6D2C4`** | Texto/logo sobre rojo |

---

## 2. Neutros (redefinidos 2026-09-28)

Lejos del look AI cream + terracota + serif (`#F4F1EA`).

| Token | Valor | Uso |
|---|---|---|
| `--tostal-papel` | `#F3F4F6` | Fondo piedra fría |
| `--tostal-papel-2` | `#E4E6EA` | Wash idle / nav |
| `--tostal-marca-soft` | `#F3E8E6` | Wash acento suave |
| `--tostal-ink` | `#171513` | Texto |
| `--tostal-marca-dark` | `#7A241C` | Hover |
| `--tostal-marca-deep` | `#4E1712` | Contraste profundo |
| `--border` | `#D2D5DA` | Separadores |
| `--tostal-ok` | `#2F6B52` | Listo |
| `--tostal-alerta` | `#A85B12` | Deadline / stock |

**Atmósfera:** papel + grano SVG + wash radial marca (≤8%). Sin purple glow.

**Tipografía**

- Brand: **Oswald** condensed bold all-caps  
- UI: **Plus Jakarta Sans** (no Inter / Roboto / Manrope / system)

---

## 3. Anclas Mobbin (resumen)

| Uso | Referencia | Adoptar |
|---|---|---|
| Menú lista | Blue Bottle · Bolt Food · Honest Greens | Texto izq., thumb der., sin cards |
| Sticky bag | Blue Bottle · CHOPT | CTA full-width thumb-zone |
| Checkout | Uber Eats · CHOPT | Tabs retiro/envío · un CTA |
| Hero marca | sweetgreen · Monte | Brand hero-level, no dashboard |
| Ops / stock | Shopify · alias · Posh | Densidad, bottom nav, empty states |

**Evitar:** badges flotantes sobre media/hero · cream+seriff · upsells apilados · broadsheet · mezclar checkout con backoffice.

Detalle: `docs/auditoria-ui-restaurantes.md`.

---

## 4. Componentes

- **Única librería:** shadcn/ui (Button, Input, Dialog, Sheet, Tabs, Badge, Alert, Select, Separator, Skeleton…).
- ReUI **retirado** (Badge/Frame/Stepper migrados).
- Cards solo donde hay interacción (fila menú / fila ops).

---

## 5. Patrones por app

### Cliente · tostal.cafe

1. Hero full-bleed `#9A2E25` + logo crema transparente.  
2. Chips de día; categorías underline/chip marca.  
3. Lista menú + botón `+` **al lado** del thumb (no overlay).  
4. Sticky **Ver carrito** con animación `cart-rise`.  
5. Seguimiento: timeline CSS + un CTA.

### Restaurant · app.tostal.cafe

1. Login: bloque `#9A2E25` + wordmark crema.  
2. Shell: bottom nav; active = wash piedra + tinta marca.  
3. Home: cifras del día + accesos densos.  
4. Pedidos/cocina/stock: filas + chips estado.

### Motion

1. `rise-in` al cargar  
2. Press `scale(0.98)`  
3. `cart-rise` en sticky bag  

---

## 6. Qué no hacer

- Sustituir `#9A2E25` / `#D6D2C4`.  
- Volver a cream `#F4F1EA` + serif editorial.  
- PNG con bloque rojo sobre hero ya rojo.  
- Segunda librería de componentes.  
- Purple / glow / dark-mode forzado.  
- Dashboard en el primer viewport del Cliente.

---

## 7. Entrega

- Tokens + Oswald/Jakarta + shadcn en `apps/cliente` y `apps/restaurant`.  
- Contratos API intactos; Railway solo `production`.  
- URLs: https://tostal.cafe · https://app.tostal.cafe  
