import { apiFetch } from "@/lib/api";
import { hoyISO, isoToHoraCdmx, sumarDias } from "@/lib/timezone";

/**
 * Cliente staff → Nest `/api/menu-dia` (contrato menú diario).
 * Hora límite se edita/envía como HH:mm CDMX; la API persiste ISO UTC.
 */

export type MenuDiaProducto = {
  productoId: string;
  productoNombre: string;
  activo: boolean;
};

export type MenuDia = {
  fecha: string;
  /** ISO UTC del deadline, o null si aún no hay día. */
  horaLimite: string | null;
  /** HH:mm CDMX para el input. */
  horaLimiteHHmm: string;
  abierto: boolean;
  productos: MenuDiaProducto[];
};

function mapProductos(raw: unknown): MenuDiaProducto[] {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((item) => {
    const p = item as Record<string, unknown>;
    return {
      productoId: String(p.productoId || p.producto_id || p.id || ""),
      productoNombre: String(
        p.productoNombre || p.producto_nombre || p.nombre || "Producto"
      ),
      activo: Boolean(p.activo ?? p.disponible ?? false),
    };
  });
}

function mapMenuDia(fecha: string, data: Record<string, unknown>): MenuDia {
  const deadline =
    (data.hora_limite as string) ||
    (data.horaLimite as string) ||
    (data.deadlinePedido as string) ||
    null;
  return {
    fecha: String(data.fecha || fecha),
    horaLimite: deadline,
    horaLimiteHHmm: isoToHoraCdmx(deadline, "18:00"),
    abierto: data.abierto !== false,
    productos: mapProductos(data.productos || data.disponibilidad),
  };
}

/** HH:mm para el input time (CDMX). */
export function horaLimiteInputValue(menu: MenuDia | null): string {
  return menu?.horaLimiteHHmm || "18:00";
}

export async function getMenuDia(fecha: string): Promise<MenuDia> {
  const res = await apiFetch(`/api/menu-dia/${fecha}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "No se pudo cargar el menú del día");
  }
  return mapMenuDia(fecha, data);
}

export async function saveMenuDia(input: {
  fecha: string;
  /** HH:mm en CDMX — la API convierte a ISO UTC */
  horaLimiteHHmm: string;
  productos: MenuDiaProducto[];
  abierto?: boolean;
}): Promise<MenuDia> {
  const hhmm = input.horaLimiteHHmm.slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(hhmm)) {
    throw new Error("Hora límite inválida (usa HH:mm CDMX).");
  }

  const res = await apiFetch(`/api/menu-dia/${input.fecha}`, {
    method: "PUT",
    body: JSON.stringify({
      abierto: input.abierto !== false,
      hora_limite: hhmm,
      horaLimite: hhmm,
      productos: input.productos.map((p) => ({
        producto_id: p.productoId,
        productoId: p.productoId,
        activo: p.activo,
        disponible: p.activo,
      })),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "No se pudo guardar el menú del día");
  }
  return mapMenuDia(input.fecha, data);
}

/** Programa D+1 / fecha vía POST /api/menu-dia/:fecha/programar */
export async function programarMenuDia(
  fecha?: string,
  opts?: { desde?: string; horaLimiteHHmm?: string }
): Promise<MenuDia> {
  const target = fecha || sumarDias(hoyISO(), 1);
  const path =
    target === sumarDias(hoyISO(), 1)
      ? `/api/menu-dia/manana/programar`
      : `/api/menu-dia/${target}/programar`;

  const body: Record<string, unknown> = {
    abierto: true,
    copiarDesde: opts?.desde || hoyISO(),
    copiar_hoy: true,
  };
  if (opts?.horaLimiteHHmm) {
    body.hora_limite = opts.horaLimiteHHmm.slice(0, 5);
    body.horaLimite = opts.horaLimiteHHmm.slice(0, 5);
  }

  const res = await apiFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "No se pudo programar el menú");
  }
  return mapMenuDia(data.fecha || target, data);
}
