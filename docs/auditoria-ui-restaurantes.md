# Auditoría UI — restaurantes / cafés / delivery / POS

**Fecha:** 2026-09-28  
**Fuente:** Mobbin MCP (`search_screens`, `search_flows`, `search_sections`)  
**Objetivo:** rediseño shadcn/ui de Tostal Cliente + Restaurant · rojo marca `#9A2E25`  
**Idioma de producto:** español

---

## 1. Alcance de la muestra

| Área | Apps / sitios revisados | Enlaces clave |
|---|---|---|
| Menú / pedir | [Honest Greens](https://mobbin.com/screens/c65a30c2-00df-4de9-bcd4-d498692dea2c), [Bolt Food](https://mobbin.com/screens/7e5edd88-153d-4eec-9c1b-eb5bbfd229f8), [Wonder](https://mobbin.com/screens/42c09863-2d43-47a1-9fc6-7e8e928effa4), [CHOPT](https://mobbin.com/screens/da891c26-4508-4b1a-9370-7846285aad3c), [Blue Bottle](https://mobbin.com/screens/65c88b8a-c071-4490-83e5-96de5acaa9c2) | Lista texto+foto, tabs categoría, bag sticky |
| Checkout / carrito | [Uber Eats Pickup](https://mobbin.com/flows/e9a686ee-4340-4498-99ea-9499730db32e), [Uber Eats Checkout](https://mobbin.com/flows/4997f6c8-d37e-43f0-9d42-5908c636ea90), [CHOPT](https://mobbin.com/flows/7b2de57c-d600-4949-8c27-450e13ee6e07), [Burger King](https://mobbin.com/flows/8c9b932f-2bb6-4683-9479-6c2ffd4481cd), [Blue Bottle bag](https://mobbin.com/screens/5c42d6ab-3ff3-4f4a-8553-ba6bec88caf6) | Toggle retiro/envío, desglose, CTA sticky |
| Brand / hero web | [sweetgreen](https://mobbin.com/sites/sections/a7dbacd8-c85d-459f-b06f-635450c43365), [Monte](https://mobbin.com/sites/sections/664a16ca-816d-495d-b577-e08ce5c6f1a5), [Savor](https://mobbin.com/sites/sections/9578c9fe-7f5c-4d32-b868-786881a90d32) | Marca hero-level vs dashboard |
| Ops / cola / stock | [alias Orders](https://mobbin.com/screens/3ffbd5fc-b59f-468d-a89a-85738785398c), [Posh Pending](https://mobbin.com/screens/dd3eeb23-c722-4796-a896-55bd04f39596), [Shopify inventory](https://mobbin.com/screens/00f98cbb-1cbc-4436-88e1-33c5d00bf8ba) | Densidad, filtros, empty states |

---

## 2. Patrones a adoptar

### Cliente (pedir)

1. **Lista menú sin cards** — fila con texto a la izquierda (nombre, descripción corta, precio) y thumb a la derecha; separadores finos (Bolt Food, Blue Bottle, Honest Greens). No cajas con sombra por cada postre.
2. **“+” táctil fuera del overlay decorativo** — el patrón Bolt pone `+` sobre la foto; para Tostal: botón `+` **al lado** del thumb o bajo el precio (misma zona thumb), sin badges flotantes sobre media.
3. **Sticky CTA de carrito** — barra inferior full-width con total + “Ver carrito” / “Confirmar · $X” (Blue Bottle, CHOPT, Burger King). Thumb-zone ≥ 48px + safe-area.
4. **Checkout denso en una columna** — toggle Retiro/Envío (Tabs), filas de datos con chevron, desglose Subtotal → Total en negrita, un solo CTA primario (Uber Eats / CHOPT).
5. **Día / hora como chips seleccionables** — fill sólido de marca en activo, borde sutil en idle (CHOPT date chips) — sin badge “MAÑANA” flotando encima.
6. **Hero de marca, no dashboard** — un bloque de marca dominante (logo wordmark + eslogan), un CTA implícito hacia el menú; sin stats ni grid (sweetgreen / Monte).

### Restaurant (operar)

1. **Densidad tipo Shopify** — filas nombre + meta + total; search arriba; contadores Open/Closed o chips de estado (alias, Shopify).
2. **Bottom nav fija** — 4–7 destinos; activo = wash neutro + acento marca en icono/texto (alias).
3. **Empty state claro** — icono línea + “No hay pedidos pendientes” + subtítulo (Posh).
4. **Steppers de stock** − / valor / + con targets grandes (Shopify location qty).
5. **Un CTA por fila operativa** — aprobar, pasar a producción, marcar listo; sin paneles ERP.

---

## 3. Patrones a evitar

| Patrón | Por qué | Visto en |
|---|---|---|
| Cream + terracota + serif editorial | Look AI recurrente; Coditeac pidió no clonarlo | Savor hero, Monte (tono), briefs previos Tostal |
| Purple / glow / dark purple | Cliché genérico AI | — |
| Broadsheet denso (rules + columnas) | No mobile-first café | — |
| Badges/stickers flotantes sobre hero o fotos | Rompen composición; brief lo prohíbe | CHOPT “TOMORROW”, Savor “Preorder” float |
| Cards decorativas en hero | Ruido; no son interacción | Varios landings |
| Upsell banners apilados encima del CTA | Compiten con conversión | Uber One strips |
| Dark flat monochrome sin atmósfera | Útil en ops, pero Tostal pide atmósfera sutil | alias / Posh |
| Mezclar checkout público con backoffice | Confunde roles | — |

---

## 4. Dirección visual concreta — Tostal

### Marca (fija)

- **Rojo principal:** `#9A2E25` (único color primario de UI).
- **Logo:** wordmark transparente (crema `#D6D2C4` sobre rojo; rojo `#9A2E25` sobre papel). Nunca PNG con bloque rojo encima de fondo ya rojo.
- **Eslogan:** “Sabores que unen culturas”.

### Neutros (redefinidos — lejos del cream AI)

| Token | Valor | Uso |
|---|---|---|
| `--tostal-marca` | `#9A2E25` | CTAs, chips activos, focus, hero |
| `--tostal-marca-dark` | `#7A241C` | Hover / pressed |
| `--tostal-marca-deep` | `#4E1712` | Header ops profundo |
| `--tostal-ink` | `#171513` | Texto |
| `--tostal-crema-logo` | `#D6D2C4` | Texto sobre rojo (asset) |
| `--tostal-papel` | `#F3F4F6` | Fondo base **piedra fría** (no #F4F1EA) |
| `--tostal-papel-2` | `#E4E6EA` | Wash idle / nav active |
| `--tostal-marca-soft` | `#F3E8E6` | Wash acento muy suave |
| `--border` | `#D2D5DA` | Separadores |
| `--tostal-ok` | `#2F6B52` | Listo |
| `--tostal-alerta` | `#A85B12` | Deadline / stock bajo |

**Atmósfera:** papel frío + grano SVG sutil + wash radial marca (≤8% opacity). Sin purple glow.

### Tipografía

- **Brand / display:** Oswald condensed bold all-caps (alinea wordmark).
- **UI:** **Plus Jakarta Sans** (expresiva, no Inter/Roboto/Manrope/system).

### Motion (2–3 intenciones)

1. `rise-in` — hero y primeras secciones al cargar.
2. Press `scale(0.98)` en botones / chips.
3. Sticky cart: entrada suave desde abajo al agregar ítem.

### shadcn/ui

Primitivos únicos: Button, Input, Textarea, Label, Badge, Tabs, Dialog, Sheet, Drawer, Select, Separator, Skeleton, Alert.  
Migrar usos ReUI (Badge/Frame/Stepper) a shadcn + patrones CSS propios. **Sin segunda librería.**

---

## 5. Mapa pantalla → patrón

### Cliente · tostal.cafe

| Pantalla | Patrón Mobbin | Tratamiento Tostal |
|---|---|---|
| Home / menú | Blue Bottle menu + Bolt lista | Hero `#9A2E25` + logo crema · chips día · lista sin card · sticky Ver carrito |
| Carrito / checkout | Uber Eats + CHOPT | Tabs retiro/envío · desglose · CTA `Confirmar · $` |
| Seguimiento | Stepper limpio (no ReUI obligatorio) | Timeline estados + un CTA |
| Cuenta | Filas simples | Sin dashboard |

### Restaurant · app.tostal.cafe

| Pantalla | Patrón Mobbin | Tratamiento Tostal |
|---|---|---|
| Login | Brand block | Bloque `#9A2E25` + logo crema transparente |
| Home panel | Shopify density | Cifras del día + accesos en filas |
| Pedidos / cocina | alias + Posh | Lista + chips estado + empty |
| Inventario | Shopify qty | Filas + steppers |
| Shell | Bottom nav 7 | Active wash piedra + tinta marca |

---

## 6. Criterios de aceptación visual

- [ ] Solo `#9A2E25` como primario; neutros piedra fría, no cream+terracota serif.
- [ ] Wordmark transparente correcto según fondo.
- [ ] Mobile-first; una composición por viewport en marketing/home.
- [ ] Sin badges flotantes sobre hero/media.
- [ ] Cards solo donde hay interacción (ítem menú actionable / fila ops).
- [ ] Copy real en español.
- [ ] Primitivos shadcn; sin nueva librería de componentes.
