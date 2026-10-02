import type {
  CrearPedidoRemotoBody,
  CrearPedidoRemotoResponse,
  GetPedidoPublicoResponse,
} from "@tostal/shared/api-public";
import { PUBLIC_API, API_DEV_ORIGIN } from "@tostal/shared/api-public";
import {
  CONTRATO_API,
  normalizeMenuHoy,
  normalizeReservaProducto,
  type CrearReservaBody,
  type CrearReservaResponse,
  type MenuHoy,
  type ReservaProducto,
} from "@/lib/contract";

/** Preferencia: NEXT_PUBLIC_API_URL → NestJS (api.tostal.cafe). */
export function getApiBase() {
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_TOSTAL_API_URL ||
    API_DEV_ORIGIN
  ).replace(/\/$/, "");
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    cache: "no-store",
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const body = data as { error?: string; message?: string | string[] };
    const msg =
      body.error ||
      (Array.isArray(body.message) ? body.message.join(", ") : body.message) ||
      `Error ${res.status}`;
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const bodyErr = data as { error?: string; message?: string | string[] };
    const msg =
      bodyErr.error ||
      (Array.isArray(bodyErr.message)
        ? bodyErr.message.join(", ")
        : bodyErr.message) ||
      "No se pudo completar la acción";
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

/**
 * Menú de hoy (contrato: GET /api/public/menu).
 * Fallback legacy: ?fecha=YYYY-MM-DD mientras la API migra.
 */
export async function fetchMenuHoy(): Promise<MenuHoy> {
  const hoy = hoyISO();
  try {
    const raw = await apiGet<Record<string, unknown>>(CONTRATO_API.menu);
    return normalizeMenuHoy(raw, hoy);
  } catch {
    const raw = await apiGet<Record<string, unknown>>(
      `${CONTRATO_API.menu}?fecha=${encodeURIComponent(hoy)}`
    );
    return normalizeMenuHoy(raw, hoy);
  }
}

/** @deprecated Preferir fetchMenuHoy — se mantiene por compat carrito. */
export async function fetchMenu(fecha?: string): Promise<MenuHoy> {
  if (!fecha || fecha === hoyISO()) return fetchMenuHoy();
  const raw = await apiGet<Record<string, unknown>>(
    `${CONTRATO_API.menu}?fecha=${encodeURIComponent(fecha)}`
  );
  return normalizeMenuHoy(raw, fecha);
}

export function crearPedido(body: CrearPedidoRemotoBody) {
  return apiPost<CrearPedidoRemotoResponse>(PUBLIC_API.pedidos, body);
}

export function fetchPedido(codigo: string) {
  return apiGet<GetPedidoPublicoResponse>(
    `${PUBLIC_API.pedidos}?codigo=${encodeURIComponent(codigo)}`
  );
}

/** GET /api/public/reservas/productos */
export async function fetchReservasProductos(): Promise<ReservaProducto[]> {
  const data = await apiGet<{
    productos?: Record<string, unknown>[];
  }>(CONTRATO_API.reservasProductos);
  const list = Array.isArray(data.productos) ? data.productos : [];
  return list.map(normalizeReservaProducto);
}

/** POST /api/public/reservas */
export function crearReserva(body: CrearReservaBody) {
  return apiPost<CrearReservaResponse>(CONTRATO_API.reservas, body);
}

export function formatoMoneda(centavos: number, moneda = "MXN"): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: moneda,
  }).format(centavos / 100);
}

/** Zona operativa Tostal — menú “hoy” y hora límite siempre en CDMX. */
export const TZ_CDMX = "America/Mexico_City";

/** YYYY-MM-DD del calendario en America/Mexico_City (no TZ del browser). */
export function hoyISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_CDMX,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Suma días a una fecha calendario YYYY-MM-DD (sin depender del browser TZ). */
export function sumarDiasISO(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + dias));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Fecha mínima de reserva: mañana CDMX (no mismo día del menú). */
export function mananaISO(now: Date = new Date()): string {
  return sumarDiasISO(hoyISO(now), 1);
}

/**
 * Fecha mínima de reserva según anticipación del producto:
 * hoy CDMX + `diasMinimos` (0 = hoy permitido).
 */
export function fechaMinimaReservaISO(
  diasMinimos: number,
  now: Date = new Date()
): string {
  const n = Number.isFinite(diasMinimos) ? Math.max(0, Math.trunc(diasMinimos)) : 0;
  return sumarDiasISO(hoyISO(now), n);
}

export function labelFecha(fecha: string): string {
  // Mediodía CDMX (UTC−6 fijo post-DST) para etiquetar el día calendario.
  const d = new Date(`${fecha}T12:00:00-06:00`);
  return d.toLocaleDateString("es-MX", {
    timeZone: TZ_CDMX,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function labelDeadline(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", {
    timeZone: TZ_CDMX,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function labelDeadlineLargo(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    timeZone: TZ_CDMX,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
