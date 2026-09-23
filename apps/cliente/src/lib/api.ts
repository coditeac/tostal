import type {
  CrearPedidoRemotoBody,
  CrearPedidoRemotoResponse,
  GetPedidoPublicoResponse,
  PublicDiasResponse,
} from "@tostal/shared/api-public";
import type { MenuDiaResponse } from "@tostal/shared/types";
import { PUBLIC_API } from "@tostal/shared/api-public";

/** Preferencia: NEXT_PUBLIC_API_URL; fallback al nombre del cimiento. */
export function getApiBase() {
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_TOSTAL_API_URL ||
    "http://127.0.0.1:4321"
  ).replace(/\/$/, "");
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ||
        "No pudimos conectar con Tostal. ¿Está corriendo la App Restaurant?"
    );
  }
  return data as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error || "No se pudo completar la acción"
    );
  }
  return data as T;
}

export function fetchDias() {
  return apiGet<PublicDiasResponse>(PUBLIC_API.dias);
}

export function fetchMenu(fecha: string) {
  return apiGet<MenuDiaResponse>(
    `${PUBLIC_API.menu}?fecha=${encodeURIComponent(fecha)}`
  );
}

export function crearPedido(body: CrearPedidoRemotoBody) {
  return apiPost<CrearPedidoRemotoResponse>(PUBLIC_API.pedidos, body);
}

export function fetchPedido(codigo: string) {
  return apiGet<GetPedidoPublicoResponse>(
    `${PUBLIC_API.pedidos}?codigo=${encodeURIComponent(codigo)}`
  );
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

export function labelFecha(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00`);
  return d.toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function labelDeadline(iso: string): string {
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
