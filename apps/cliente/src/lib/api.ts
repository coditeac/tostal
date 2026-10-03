/**
 * Data layer Cliente → Supabase (sin Nest / sin NEXT_PUBLIC_API_URL).
 * Conserva las firmas que consume la UI Rappi (#32).
 */

import type {
  CrearPedidoRemotoBody,
  CrearPedidoRemotoResponse,
  GetPedidoPublicoResponse,
} from "@tostal/shared/api-public";
import {
  normalizeMenuHoy,
  normalizeReservaProducto,
  type CrearReservaBody,
  type CrearReservaResponse,
  type GetReservaPublicaResponse,
  type MenuHoy,
  type ReservaProducto,
} from "@/lib/contract";
import { createClienteBrowserClient } from "@/lib/supabase/client";
import { publicProductImageUrl } from "@/lib/supabase/env";
import type { Json } from "@/lib/supabase/database.types";
import {
  notificarPedidoCreadoAction,
  notificarReservaCreadaAction,
} from "@/app/actions/mail";
import { iniciarCheckoutPendiente } from "@/app/actions/mercadopago";

function sb() {
  return createClienteBrowserClient();
}

function rpcError(err: { message?: string; code?: string } | null): Error & {
  status?: number;
} {
  const msg = err?.message || "No se pudo completar la acción";
  const e = new Error(msg) as Error & { status?: number };
  if (err?.code === "P0002" || /no encontrad/i.test(msg)) e.status = 404;
  else if (err?.code === "P0001") e.status = 400;
  else e.status = 500;
  return e;
}

/** @deprecated Ya no hay API Nest; se mantiene por compat media relativa. */
export function getApiBase() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://yoxsldirdgdpsabsivac.supabase.co"
  ).replace(/\/$/, "");
}

export async function fetchMenuHoy(): Promise<MenuHoy> {
  const hoy = hoyISO();
  const { data, error } = await sb().rpc("get_menu_hoy");
  if (error) throw rpcError(error);
  const raw = (data ?? {}) as Record<string, unknown>;
  const menu = normalizeMenuHoy(raw, hoy);
  menu.productos = menu.productos.map((p) => ({
    ...p,
    fotoUrl: publicProductImageUrl(p.fotoUrl) ?? p.fotoUrl,
    imagen_url: publicProductImageUrl(
      (p as { imagen_url?: string | null }).imagen_url ?? p.fotoUrl
    ),
  }));
  return menu;
}

/** @deprecated Preferir fetchMenuHoy — se mantiene por compat carrito. */
export async function fetchMenu(fecha?: string): Promise<MenuHoy> {
  if (!fecha || fecha === hoyISO()) return fetchMenuHoy();
  // Solo menú de hoy en el modelo CDMX; ignora otras fechas.
  return fetchMenuHoy();
}

function esPagoMercadoPago(metodo: string | null | undefined): boolean {
  return metodo === "mercadopago" || metodo === "stripe";
}

export async function crearPedido(
  body: CrearPedidoRemotoBody
): Promise<CrearPedidoRemotoResponse> {
  /** Mercado Pago: no crear pedido hasta pago aprobado. */
  if (esPagoMercadoPago(body.metodoPago)) {
    const checkout = await iniciarCheckoutPendiente({
      tipo: "pedido",
      body: body as unknown as Record<string, unknown>,
    });
    if (!checkout.ok) {
      const e = new Error(
        checkout.error || "No se pudo iniciar el pago con Mercado Pago"
      ) as Error & { status?: number; checkoutId?: string };
      e.status = 502;
      e.checkoutId = checkout.checkoutId;
      throw e;
    }
    if (checkout.mock && checkout.codigo) {
      const created = await fetchPedido(checkout.codigo);
      return {
        pedido: created.pedido,
        checkoutUrl: null,
        pagoMock: true,
        checkoutId: checkout.checkoutId,
      };
    }
    return {
      pedido: {
        id: checkout.checkoutId || "",
        codigo: checkout.checkoutId?.slice(0, 8).toUpperCase() || "PENDIENTE",
        canal: "remoto",
        estado: "recibido",
        estadoPago: "pendiente",
        metodoPago: "mercadopago",
        modoEntrega: body.modoEntrega,
        fechaEntrega: body.fechaEntrega,
        clienteNombre: body.clienteNombre,
        clienteTelefono: body.clienteTelefono,
        subtotal: 0,
        costoEnvio: 0,
        total: 0,
        notas: body.notas || null,
        creadoEn: new Date().toISOString(),
        lineas: [],
      },
      checkoutUrl: checkout.checkoutUrl ?? null,
      pagoMock: false,
      checkoutId: checkout.checkoutId,
    };
  }

  const { data, error } = await sb().rpc("crear_pedido_publico", {
    p_body: body as unknown as Json,
  });
  if (error) throw rpcError(error);
  const result = data as unknown as CrearPedidoRemotoResponse;
  const email = body.clienteEmail || body.email || null;
  try {
    await notificarPedidoCreadoAction({
      pedido: {
        id: result.pedido.id,
        codigo: result.pedido.codigo,
        clienteNombre: result.pedido.clienteNombre,
        fechaEntrega: result.pedido.fechaEntrega,
        total: result.pedido.total,
        estado: result.pedido.estado || "recibido",
        modoEntrega: result.pedido.modoEntrega,
        canal: result.pedido.canal,
      },
      email,
    });
  } catch (e) {
    console.error("[mail:pedido_creado]", e);
  }

  return result;
}

export async function fetchPedido(
  codigo: string
): Promise<GetPedidoPublicoResponse> {
  const { data, error } = await sb().rpc("get_pedido_publico", {
    p_codigo: codigo,
  });
  if (error) throw rpcError(error);
  return data as unknown as GetPedidoPublicoResponse;
}

export async function fetchReserva(
  codigo: string
): Promise<GetReservaPublicaResponse> {
  const { data, error } = await sb().rpc("get_reserva_publica", {
    p_codigo: codigo,
  });
  if (error) throw rpcError(error);
  return data as unknown as GetReservaPublicaResponse;
}

export async function resolverSeguimiento(
  codigo: string
): Promise<
  | { tipo: "pedido"; codigo: string }
  | { tipo: "reserva"; codigo: string }
  | { tipo: "ninguno"; error: string }
> {
  const clean = codigo.trim().toUpperCase();
  if (!clean) return { tipo: "ninguno", error: "Escribe un código." };

  const tryPedido = async () => {
    await fetchPedido(clean);
    return { tipo: "pedido" as const, codigo: clean };
  };
  const tryReserva = async () => {
    await fetchReserva(clean);
    return { tipo: "reserva" as const, codigo: clean };
  };

  const first = clean.startsWith("R-") ? tryReserva : tryPedido;
  const second = clean.startsWith("R-") ? tryPedido : tryReserva;

  try {
    return await first();
  } catch {
    try {
      return await second();
    } catch (e) {
      return {
        tipo: "ninguno",
        error:
          e instanceof Error ? e.message : "No encontramos ese código.",
      };
    }
  }
}

export async function fetchReservasProductos(): Promise<ReservaProducto[]> {
  const { data, error } = await sb().rpc("list_reservas_productos");
  if (error) throw rpcError(error);
  const list = Array.isArray(data) ? data : [];
  return list.map((raw) => {
    const p = normalizeReservaProducto(raw as Record<string, unknown>);
    return {
      ...p,
      fotoUrl: publicProductImageUrl(p.fotoUrl),
    };
  });
}

export async function crearReserva(
  body: CrearReservaBody
): Promise<CrearReservaResponse> {
  /** Mercado Pago: no crear reserva hasta anticipo aprobado. */
  if (esPagoMercadoPago(body.metodoPago)) {
    const checkout = await iniciarCheckoutPendiente({
      tipo: "reserva",
      body: body as unknown as Record<string, unknown>,
    });
    if (!checkout.ok) {
      const e = new Error(
        checkout.error || "No se pudo iniciar el anticipo con Mercado Pago"
      ) as Error & { status?: number; checkoutId?: string };
      e.status = 502;
      e.checkoutId = checkout.checkoutId;
      throw e;
    }
    if (checkout.mock && checkout.codigo) {
      const created = await fetchReserva(checkout.codigo);
      return {
        reserva: {
          ...created.reserva,
          checkoutUrl: null,
          estadoAnticipo: "pagado",
        },
      };
    }
    return {
      reserva: {
        id: checkout.checkoutId || "",
        codigo: "PENDIENTE",
        fechaEntrega: body.fechaEntrega || body.fecha || "",
        total: 0,
        anticipoMonto: 0,
        estado: "recibido",
        estadoAnticipo: "pendiente",
        checkoutUrl: checkout.checkoutUrl ?? null,
      },
    };
  }

  const { data, error } = await sb().rpc("crear_reserva_publica", {
    p_body: body as unknown as Json,
  });
  if (error) throw rpcError(error);
  const result = data as unknown as CrearReservaResponse;
  try {
    await notificarReservaCreadaAction({
      reserva: {
        id: result.reserva.id,
        codigo: result.reserva.codigo,
        clienteNombre: body.clienteNombre || "Cliente",
        fechaEntrega: result.reserva.fechaEntrega,
        total: result.reserva.total,
        anticipoMonto: result.reserva.anticipoMonto,
        estado: result.reserva.estado || "recibido",
        estadoAnticipo:
          result.reserva.estadoAnticipo || "pendiente_verificacion",
        modoEntrega: body.modoEntrega || "retiro",
      },
      email: body.clienteEmail || null,
    });
  } catch (e) {
    console.error("[mail:reserva_creada]", e);
  }

  return result;
}

/** Pedidos del usuario autenticado (cuenta). */
export async function fetchMisPedidos(): Promise<
  Array<{
    id: string;
    codigo: string;
    fechaEntrega: string;
    estado: string;
    total: number;
  }>
> {
  const client = sb();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return [];

  const { data, error } = await client
    .from("pedidos")
    .select("id, codigo, fecha_entrega, estado, total")
    .eq("cliente_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw rpcError(error);
  return (data || []).map((p) => ({
    id: p.id,
    codigo: p.codigo,
    fechaEntrega: p.fecha_entrega,
    estado: p.estado,
    total: Math.round(Number(p.total) || 0),
  }));
}

export function formatoMoneda(centavos: number, moneda = "MXN"): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: moneda,
  }).format(centavos / 100);
}

export const TZ_CDMX = "America/Mexico_City";

export function hoyISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_CDMX,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function sumarDiasISO(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + dias));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function mananaISO(now: Date = new Date()): string {
  return sumarDiasISO(hoyISO(now), 1);
}

export function fechaMinimaReservaISO(
  diasMinimos: number,
  now: Date = new Date()
): string {
  const n = Number.isFinite(diasMinimos)
    ? Math.max(0, Math.trunc(diasMinimos))
    : 0;
  return sumarDiasISO(hoyISO(now), n);
}

export function labelFecha(fecha: string): string {
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
