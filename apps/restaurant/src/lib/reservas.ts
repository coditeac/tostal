import {
  listReservasCola,
  updateReservaEstado,
} from "@/lib/data/reservas";
import type { InsumoNecesario, ReservaCola } from "@/lib/reservas-types";

export type { InsumoNecesario, ReservaCola };

export async function listReservas(opts?: {
  incluirAnuladas?: boolean;
}): Promise<{
  reservas: ReservaCola[];
  disponible: boolean;
  mensaje?: string;
}> {
  const reservas = await listReservasCola(opts);
  return { reservas, disponible: true };
}

export { updateReservaEstado };
