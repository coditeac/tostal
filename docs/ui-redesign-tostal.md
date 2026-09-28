# Brief de dirección visual — Tostal

**Marca:** Tostal · *Sabores que unen culturas*  
**Apps:** Cliente (pedir) · Restaurant (operar)  
**Owner visual:** Coditeac · **HeroUI-inspired** (look & feel) · **shadcn/ui** · mobile first · español  
**Referencia estética:** [heroui.com](https://heroui.com) — tipografía limpia, mucho aire, bordes suaves, superficies planas, CTAs claros, motion sutil. **No** se usa el package HeroUI/NextUI.  
**Doc auditoría (patrones menú/ops):** `docs/auditoria-ui-restaurantes.md`

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

## 2. Neutros HeroUI-inspired (2026-09-28)

Lejos del look AI cream+terracota+serif (`#F4F1EA`) y del purple glow.

| Token | Valor | Uso |
|---|---|---|
| `--tostal-papel` | `#FAFAFA` | Fondo claro casi blanco |
| `--tostal-papel-2` | `#F4F4F5` | Wash idle / nav active |
| `--tostal-marca-soft` | `#F5EBE9` | Wash acento suave |
| `--tostal-ink` | `#111113` | Texto alto contraste |
| `--tostal-marca-dark` | `#7A241C` | Hover |
| `--tostal-marca-deep` | `#4E1712` | Contraste profundo |
| `--border` | `#E4E4E7` | Separadores suaves |
| `--muted-foreground` | `#71717A` | Texto secundario |
| `--radius` | `0.75rem` | Bordes suaves (no pills densas) |
| `--tostal-ok` | `#2F6B52` | Listo |
| `--tostal-alerta` | `#A85B12` | Deadline / stock |

**Atmósfera:** un wash radial marca ≤5%. Sin grano denso. Sin purple glow.

**Tipografía**

- **UI global:** **Geist** (`next/font/google` → `--font-geist`) — body, headings, nav, botones, precios, menú, shadcn.  
- **Solo logo / wordmark texto “Tostal”:** **Arch Condensed** (`arch-9`) vía `.font-brand` / `.hero-wordmark`.  
- PNG de logo: no se fuerza Arch.

---

## 3. Principios HeroUI → Tostal

1. **Mucho aire** — secciones con `space-y-8…10`, tipografía respirada, menos densidad visual en Cliente.  
2. **Superficies planas** — sin sombras decorativas; bordes 1px suaves o solo divisores.  
3. **Pocas cards** — sin cards en heroes; cards/superficies **solo** cuando son contenedor de interacción real. Preferir listas tipográficas (`.list-plain`), underline tabs, separadores.  
4. **CTAs claros** — un primario marca; secundarios outline/ghost flat.  
5. **Motion sutil** — `rise-in`, press `scale(0.98)`, `cart-rise`. Sin glow animado agresivo.  
6. **Categorías underline** — estilo docs (borde inferior marca), no pills rellenas.  
7. **Day chips** — idle = borde sutil / fondo transparente; activo = fill marca.

---

## 4. Anclas de flujo (auditoría Mobbin, vigente)

| Uso | Adoptar |
|---|---|
| Menú lista | Texto izq., thumb der., `+` al lado (no overlay), sin caja card envolvente |
| Sticky bag | CTA full-width thumb-zone |
| Checkout | Tabs retiro/envío · un CTA · secciones con Separator, no cajas apiladas |
| Hero marca | Full-bleed `#9A2E25` + logo crema · una composición |
| Ops | Filas + divisores · bottom nav · empty states tipográficos |

---

## 5. Componentes

- **Única librería:** shadcn/ui.  
- **No** HeroUI / NextUI / ReUI.  
- Utilidades locales: `.list-plain`, `.empty-state`, `.section-title`, `.section-lead`, `.hero-brand`.

---

## 6. Patrones por app

### Cliente · tostal.cafe

1. Hero full-bleed `#9A2E25` + logo crema.  
2. Chips de día (activo marca).  
3. Categorías underline.  
4. Lista menú sin card envolvente + `+` al lado del thumb.  
5. Sticky **Ver carrito**.  
6. Checkout / seguimiento: tipografía + divisores.

### Restaurant · app.tostal.cafe

1. Login: brand plane full-bleed + formulario debajo (**sin** card envolvente).  
2. Shell: bottom nav; top links underline; active = wash piedra.  
3. Home: cifras tipográficas + accesos en lista.  
4. Pedidos/cocina/stock: filas + CTAs de acción (interacción real).

---

## 7. Qué no hacer

- Sustituir `#9A2E25` / `#D6D2C4`.  
- Volver a cream `#F4F1EA` + serif editorial.  
- Instalar HeroUI/NextUI.  
- Cards en heroes o cajas decorativas en listas.  
- Purple / glow / dark-mode forzado.  
- Dashboard en el primer viewport del Cliente.

---

## 8. Entrega

- Tokens HeroUI-inspired + Geist (UI) + Arch Condensed (solo wordmark) + shadcn.  
- Contratos API / auth / Resend / superadmin intactos.  
- URLs: https://tostal.cafe · https://app.tostal.cafe  
