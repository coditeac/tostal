export function formatoMoneda(centavos: number, moneda = "MXN"): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: moneda,
  }).format(centavos / 100);
}

export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function labelFecha(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00`);
  return d.toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
