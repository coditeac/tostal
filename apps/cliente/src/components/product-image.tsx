"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Extrae URL de foto desde campos API (fotoUrl / imagen_url / …). */
export function resolveFotoUrl(
  source?: {
    fotoUrl?: string | null;
    foto_url?: string | null;
    imagen_url?: string | null;
    imagenUrl?: string | null;
  } | null
): string | null {
  if (!source) return null;
  const raw =
    source.fotoUrl ||
    source.foto_url ||
    source.imagen_url ||
    source.imagenUrl ||
    null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
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
 * Mobile-first; no fuerza next/image (URLs de storage variables).
 */
export function ProductImage({
  src,
  alt,
  className,
  size = "md",
  fallbackLabel,
}: ProductImageProps) {
  const [broken, setBroken] = useState(false);
  const showImg = Boolean(src) && !broken;
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
          src={src!}
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
