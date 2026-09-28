import { apiFetch } from "@/lib/api";

/** Contrato Nest: menú del día (con fallback a /api/calendario). */

export type MenuDiaProducto = {
  productoId: string;
  productoNombre: string;
  activo: boolean;
};

export type MenuDia = {
  fecha: string;
  horaLimite: string; // ISO datetime
  productos: MenuDiaProducto[];
  fuente: "menu-dia" | "calendario";
};

function toHoraLocalInput(iso: string, fechaFallback: string): string {
  const d = iso ? new Date(iso) : new Date(`${fechaFallback}T18:00:00`);
  if (Number.isNaN(d.getTime())) return `${fechaFallback}T18:00`;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function horaLimiteInputValue(menu: MenuDia | null, fecha: string): string {
  return toHoraLocalInput(menu?.horaLimite || `${fecha}T18:00:00`, fecha);
}

async function fromMenuDia(fecha: string): Promise<MenuDia | null> {
  const res = await apiFetch(`/api/menu-dia/${fecha}`);
  if (res.status === 404) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "No se pudo cargar el menú del día");

  const productosRaw =
    data.productos ||
    data.items ||
    data.disponibilidad ||
    [];

  return {
    fecha: data.fecha || fecha,
    horaLimite:
      data.hora_limite ||
      data.horaLimite ||
      data.deadlinePedido ||
      `${fecha}T18:00:00.000Z`,
    productos: (productosRaw as Array<Record<string, unknown>>).map((p) => ({
      productoId: String(p.productoId || p.producto_id || p.id || ""),
      productoNombre: String(
        p.productoNombre || p.producto_nombre || p.nombre || "Producto"
      ),
      activo: Boolean(
        p.activo ?? p.disponible ?? p.activoCatalogo ?? false
      ),
    })),
    fuente: "menu-dia",
  };
}

async function fromCalendario(fecha: string): Promise<MenuDia> {
  const res = await apiFetch(`/api/calendario?fecha=${fecha}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "No se pudo cargar el día");

  const disp = (data.disponibilidad || []) as Array<{
    productoId: string;
    productoNombre: string;
    disponible: boolean;
  }>;

  return {
    fecha,
    horaLimite:
      data.dia?.deadlinePedido || `${fecha}T18:00:00.000Z`,
    productos: disp.map((d) => ({
      productoId: d.productoId,
      productoNombre: d.productoNombre,
      activo: d.disponible,
    })),
    fuente: "calendario",
  };
}

export async function getMenuDia(fecha: string): Promise<MenuDia> {
  try {
    const native = await fromMenuDia(fecha);
    if (native) return native;
  } catch {
    /* fallback */
  }
  return fromCalendario(fecha);
}

export async function saveMenuDia(input: {
  fecha: string;
  horaLimiteLocal: string;
  productos: MenuDiaProducto[];
  fuente?: MenuDia["fuente"];
}): Promise<MenuDia> {
  const horaLimiteIso = new Date(input.horaLimiteLocal).toISOString();

  // Contrato nuevo
  const putRes = await apiFetch(`/api/menu-dia/${input.fecha}`, {
    method: "PUT",
    body: JSON.stringify({
      hora_limite: horaLimiteIso,
      horaLimite: horaLimiteIso,
      productos: input.productos.map((p) => ({
        producto_id: p.productoId,
        productoId: p.productoId,
        activo: p.activo,
      })),
    }),
  });

  if (putRes.ok) {
    const data = await putRes.json().catch(() => ({}));
    return {
      fecha: input.fecha,
      horaLimite:
        data.hora_limite || data.horaLimite || horaLimiteIso,
      productos: input.productos,
      fuente: "menu-dia",
    };
  }

  if (putRes.status !== 404) {
    const data = await putRes.json().catch(() => ({}));
    throw new Error(data.error || "No se pudo guardar el menú del día");
  }

  // Fallback calendario legacy
  const res = await apiFetch("/api/calendario", {
    method: "PUT",
    body: JSON.stringify({
      fecha: input.fecha,
      abierto: true,
      deadlinePedido: horaLimiteIso,
      disponibilidad: input.productos.map((p) => ({
        productoId: p.productoId,
        disponible: p.activo,
      })),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "No se pudo guardar el día");

  return {
    fecha: input.fecha,
    horaLimite: data.dia?.deadlinePedido || horaLimiteIso,
    productos: (data.disponibilidad || input.productos).map(
      (d: { productoId: string; productoNombre?: string; disponible?: boolean; activo?: boolean }) => ({
        productoId: d.productoId,
        productoNombre:
          d.productoNombre ||
          input.productos.find((p) => p.productoId === d.productoId)
            ?.productoNombre ||
          "Producto",
        activo: Boolean(d.disponible ?? d.activo),
      })
    ),
    fuente: "calendario",
  };
}

/** Programa D+1 / fecha: POST contrato o copia desde hoy vía calendario. */
export async function programarMenuDia(fecha: string, desde?: string): Promise<MenuDia> {
  const res = await apiFetch(`/api/menu-dia/${fecha}/programar`, {
    method: "POST",
    body: JSON.stringify({ desde: desde || undefined }),
  });

  if (res.ok) {
    return getMenuDia(fecha);
  }

  if (res.status !== 404) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "No se pudo programar el menú");
  }

  const origen = desde || (() => {
    const d = new Date(`${fecha}T12:00:00`);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();

  const copyRes = await apiFetch("/api/calendario", {
    method: "PUT",
    body: JSON.stringify({ fecha, copiarDesde: origen }),
  });
  const copyData = await copyRes.json().catch(() => ({}));
  if (!copyRes.ok) {
    throw new Error(copyData.error || "No se pudo copiar el menú");
  }

  return getMenuDia(fecha);
}
