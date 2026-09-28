import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { hoyISO as hoyISOCdmx, labelFecha as labelFechaCdmx } from "./timezone";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatoMoneda(centavos: number, moneda = "MXN"): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: moneda,
  }).format(centavos / 100);
}

/** Hoy en CDMX (`America/Mexico_City`). */
export function hoyISO(): string {
  return hoyISOCdmx();
}

export function labelFecha(fecha: string): string {
  return labelFechaCdmx(fecha);
}
