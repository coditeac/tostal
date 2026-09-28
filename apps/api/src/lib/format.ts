export function formatoMoneda(centavos: number, moneda = "MXN"): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: moneda,
  }).format(centavos / 100);
}

export { hoyISO, sumarDias, TZ_CDMX } from "./utils";

export function labelFecha(fecha: string): string {
  // Mediodía UTC evita corrimientos de día al formatear en es-MX/CDMX.
  const d = new Date(`${fecha}T18:00:00.000Z`);
  return d.toLocaleDateString("es-MX", {
    timeZone: "America/Mexico_City",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
