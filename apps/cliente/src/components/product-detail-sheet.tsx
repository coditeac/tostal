"use client";

import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ProductImage, resolveFotoUrl } from "@/components/product-image";
import { formatoMoneda } from "@/lib/api";
import type { MenuProducto } from "@/lib/contract";

type ProductDetailSheetProps = {
  product: MenuProducto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moneda?: string;
  disabled?: boolean;
  onAdd: (product: MenuProducto, qty: number) => void;
};

/**
 * Detalle estilo food-delivery (Mobbin Rappi PDP):
 * foto grande · copy · sticky qty + CTA marca.
 */
export function ProductDetailSheet({
  product,
  open,
  onOpenChange,
  moneda = "MXN",
  disabled = false,
  onAdd,
}: ProductDetailSheetProps) {
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (open) setQty(1);
  }, [open, product?.id]);

  if (!product) return null;

  const foto = resolveFotoUrl(product);
  const total = product.precio * qty;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="z-[60] mx-auto max-h-[92dvh] w-full max-w-lg gap-0 overflow-y-auto rounded-t-2xl p-0"
      >
        <ProductImage
          src={foto}
          alt={product.nombre}
          size="hero"
          fallbackLabel={product.nombre}
          className="border-b border-border"
        />

        <SheetHeader className="gap-2 px-5 pt-5 pb-2 text-left">
          <SheetTitle className="text-xl font-semibold tracking-tight">
            {product.nombre}
          </SheetTitle>
          {product.categoriaNombre && (
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {product.categoriaNombre}
            </p>
          )}
          <p className="text-lg font-semibold tabular-nums text-miel">
            {formatoMoneda(product.precio, moneda)}
          </p>
          {product.descripcion && (
            <SheetDescription className="text-sm leading-relaxed text-muted-foreground">
              {product.descripcion}
            </SheetDescription>
          )}
          {product.alergenos && (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Alérgenos: {product.alergenos}
            </p>
          )}
        </SheetHeader>

        <SheetFooter className="sticky bottom-0 border-t border-border bg-popover px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="flex w-full items-center gap-3">
            <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Menos"
                disabled={qty <= 1}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                <Minus size={16} />
              </Button>
              <span className="w-8 text-center text-sm font-semibold tabular-nums">
                {qty}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Más"
                onClick={() => setQty((q) => q + 1)}
              >
                <Plus size={16} />
              </Button>
            </div>
            <Button
              type="button"
              className="min-h-[var(--tap)] flex-1 justify-between"
              disabled={disabled}
              onClick={() => {
                onAdd(product, qty);
                onOpenChange(false);
              }}
            >
              <span>Agregar</span>
              <span className="tabular-nums">
                {formatoMoneda(total, moneda)}
              </span>
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
