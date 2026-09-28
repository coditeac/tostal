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

export function hoyISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Fecha mínima de reserva: mañana (no mismo día del menú). */
export function mananaISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function labelFecha(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00`);
  return d.toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function labelDeadline(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function labelDeadlineLargo(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
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
