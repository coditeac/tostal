"use client";

import { createClient } from "@/lib/supabase/client";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;
export const FOTO_ACCEPT = ACCEPT;

export function resolveFotoUrl(
  raw: string | null | undefined
): string | null {
  if (raw == null || raw === "") return null;
  const s = String(raw);
  if (
    s.startsWith("http://") ||
    s.startsWith("https://") ||
    s.startsWith("blob:")
  ) {
    return s;
  }
  if (s.startsWith("/")) {
    const base = (
      process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    ).replace(/\/$/, "");
    return `${base}/storage/v1/object/public/productos${s.startsWith("/") ? s : `/${s}`}`;
  }
  return s;
}

export function fotoUrlFromProducto(
  p: Record<string, unknown> | null | undefined
): string | null {
  if (!p) return null;
  const raw =
    p.fotoUrl ?? p.foto_url ?? p.imagenUrl ?? p.imagen_url ?? p.imageUrl;
  return resolveFotoUrl(raw == null || raw === "" ? null : String(raw));
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

function extOf(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export async function uploadProductoFoto(
  productoId: string,
  file: File
): Promise<{ fotoUrl: string | null; raw: Record<string, unknown> }> {
  const err = validateFotoFile(file);
  if (err) throw new Error(err);

  const supabase = createClient();
  const path = `${productoId}/${Date.now()}.${extOf(file)}`;
  const { error: upErr } = await supabase.storage
    .from("productos")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (upErr) throw new Error(upErr.message);

  const { data: pub } = supabase.storage.from("productos").getPublicUrl(path);
  const fotoUrl = pub.publicUrl;

  const { data, error } = await supabase
    .from("productos")
    .update({ imagen_url: fotoUrl, updated_at: new Date().toISOString() })
    .eq("id", productoId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  return {
    fotoUrl,
    raw: { ...(data as unknown as Record<string, unknown>), url: fotoUrl },
  };
}

export async function removeProductoFoto(
  productoId: string
): Promise<{ fotoUrl: null; raw: Record<string, unknown> }> {
  const supabase = createClient();
  const { data: prev } = await supabase
    .from("productos")
    .select("imagen_url")
    .eq("id", productoId)
    .maybeSingle();

  const url = prev?.imagen_url;
  if (url && url.includes("/storage/v1/object/public/productos/")) {
    const key = url.split("/storage/v1/object/public/productos/")[1];
    if (key) {
      await supabase.storage.from("productos").remove([key]);
    }
  }

  const { data, error } = await supabase
    .from("productos")
    .update({ imagen_url: null, updated_at: new Date().toISOString() })
    .eq("id", productoId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return { fotoUrl: null, raw: data as unknown as Record<string, unknown> };
}
