"use client";

import { useState } from "react";
import { getApiBase } from "@/lib/api";
import {
  resolveProductoFotoUrl,
  type ProductoFotoFields,
} from "@/lib/contract";
import { cn } from "@/lib/utils";

/** Convierte path relativo `/api/media/...` en URL absoluta al API. */
export function absolutizeMediaUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:")) {
    return trimmed;
  }
  const base = getApiBase();
  if (trimmed.startsWith("/")) return `${base}${trimmed}`;
  return `${base}/${trimmed}`;
}

/** Extrae URL de foto desde campos API (imagen_url / foto_url / fotoUrl / …). */
export function resolveFotoUrl(
  source?: ProductoFotoFields | null
): string | null {
  if (!source) return null;
  return absolutizeMediaUrl(resolveProductoFotoUrl(source));
}

type ProductImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  /** Tamaño visual: lista | detalle | carrito */
  size?: "sm" | "md" | "lg" | "hero";
  /** Primera palabra / inicial para placeholder */
  fallbackLabel?: string;
};

const SIZE: Record<NonNullable<ProductImageProps["size"]>, string> = {
  sm: "h-12 w-12",
  md: "h-[4.75rem] w-[4.75rem]",
  lg: "h-28 w-28",
  hero: "h-56 w-full sm:h-64",
};

/**
 * Foto de producto con placeholder marca si falta URL o falla la carga.
 * Consume `imagen_url` / `foto_url` / `fotoUrl` del menú público (PR #31).
 */
export function ProductImage({
  src,
  alt,
  className,
  size = "md",
  fallbackLabel,
}: ProductImageProps) {
  const [broken, setBroken] = useState(false);
  const resolved = absolutizeMediaUrl(src);
  const showImg = Boolean(resolved) && !broken;
  const label =
    (fallbackLabel || alt || "?").trim().split(/\s+/)[0]?.slice(0, 10) || "·";

  return (
    <div
      className={cn(
        "product-photo relative shrink-0 overflow-hidden",
        SIZE[size],
        size === "hero" ? "rounded-none" : "rounded-[calc(var(--radius)*0.9)]",
        className
      )}
      aria-hidden={showImg ? undefined : true}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolved!}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="product-photo-fallback">{label}</span>
      )}
    </div>
  );
}
