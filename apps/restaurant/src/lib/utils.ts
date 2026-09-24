export { cn, formatoMoneda, hoyISO, labelFecha } from "./format";

export function sumarDias(fechaISO: string, dias: number): string {
  const d = new Date(`${fechaISO}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function aCentavos(pesos: number): number {
  return Math.round(pesos * 100);
}

export function deCentavos(centavos: number): number {
  return centavos / 100;
}
