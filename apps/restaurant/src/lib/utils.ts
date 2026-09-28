export { cn, formatoMoneda, hoyISO, labelFecha } from "./format";
export { sumarDias } from "./timezone";

export function aCentavos(pesos: number): number {
  return Math.round(pesos * 100);
}

export function deCentavos(centavos: number): number {
  return centavos / 100;
}
