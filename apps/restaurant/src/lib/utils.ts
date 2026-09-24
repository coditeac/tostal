export { cn } from "cn";

export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function sumarDias(fechaISO: string, dias: number): string {
  const d = new Date(`${fechaISO}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function formatoMoneda(centavos: number, moneda = "MXN"): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: moneda,
  }).format(centavos / 100);
}

/** Precio en pesos → centavos enteros */
export function aCentavos(pesos: number): number {
  return Math.round(pesos * 100);
}

export function deCentavos(centavos: number): number {
  return centavos / 100;
}
