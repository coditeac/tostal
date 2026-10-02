import { apiFetch } from "./api";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;

export const FOTO_ACCEPT = ACCEPT;

export function fotoUrlFromProducto(
  p: Record<string, unknown> | null | undefined
): string | null {
  if (!p) return null;
  const raw =
    p.fotoUrl ?? p.foto_url ?? p.imagenUrl ?? p.imagen_url ?? p.imageUrl;
  if (raw == null || raw === "") return null;
  return String(raw);
}

export function fotoUrlFromResponse(data: Record<string, unknown>): string | null {
  const nested =
    data.producto && typeof data.producto === "object"
      ? (data.producto as Record<string, unknown>)
      : null;
  return (
    fotoUrlFromProducto(data) ??
    fotoUrlFromProducto(nested) ??
    (data.url != null ? String(data.url) : null)
  );
}

export function validateFotoFile(file: File): string | null {
  const okType =
    file.type === "image/jpeg" ||
    file.type === "image/png" ||
    file.type === "image/webp" ||
    /\.(jpe?g|png|webp)$/i.test(file.name);
  if (!okType) return "Usa JPG, PNG o WebP.";
  if (file.size > MAX_BYTES) return "La imagen debe pesar máximo 5 MB.";
  return null;
}

function formWithFile(file: File): FormData {
  const fd = new FormData();
  // API puede leer cualquiera de estos nombres de campo.
  fd.append("file", file);
  fd.append("foto", file);
  fd.append("imagen", file);
  return fd;
}

/**
 * Sube foto del producto.
 * Primario: POST /api/productos/:id/foto
 * Fallback: POST /api/productos/:id/imagen
 */
export async function uploadProductoFoto(
  productoId: string,
  file: File
): Promise<{ fotoUrl: string | null; raw: Record<string, unknown> }> {
  const err = validateFotoFile(file);
  if (err) throw new Error(err);

  const paths = [
    `/api/productos/${productoId}/foto`,
    `/api/productos/${productoId}/imagen`,
  ];

  let lastError = "No se pudo subir la foto.";
  for (const path of paths) {
    const res = await apiFetch(path, {
      method: "POST",
      body: formWithFile(file),
    });
    const data = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (res.ok) {
      return { fotoUrl: fotoUrlFromResponse(data), raw: data };
    }
    if (res.status === 404) {
      lastError =
        (typeof data.error === "string" && data.error) || lastError;
      continue;
    }
    throw new Error(
      (typeof data.error === "string" && data.error) ||
        `Error al subir foto (${res.status}).`
    );
  }
  throw new Error(lastError);
}

/**
 * Quita foto del producto.
 * DELETE /foto → DELETE /imagen → PATCH fotoUrl null.
 */
export async function removeProductoFoto(
  productoId: string
): Promise<{ fotoUrl: null; raw: Record<string, unknown> }> {
  const deletePaths = [
    `/api/productos/${productoId}/foto`,
    `/api/productos/${productoId}/imagen`,
  ];

  for (const path of deletePaths) {
    const res = await apiFetch(path, { method: "DELETE" });
    const data = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (res.ok || res.status === 204) {
      return { fotoUrl: null, raw: data };
    }
    if (res.status === 404) continue;
    throw new Error(
      (typeof data.error === "string" && data.error) ||
        `Error al quitar foto (${res.status}).`
    );
  }

  const res = await apiFetch(`/api/productos/${productoId}`, {
    method: "PATCH",
    body: JSON.stringify({
      fotoUrl: null,
      foto_url: null,
      imagen_url: null,
      imagenUrl: null,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!res.ok) {
    throw new Error(
      (typeof data.error === "string" && data.error) ||
        "No se pudo quitar la foto."
    );
  }
  return { fotoUrl: null, raw: data };
}
