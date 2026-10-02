import {
  listReservasCola,
  updateReservaEstado,
} from "@/lib/data/reservas";
import type { InsumoNecesario, ReservaCola } from "@/lib/reservas-types";

export type { InsumoNecesario, ReservaCola };

export async function listReservas(): Promise<{
  reservas: ReservaCola[];
  disponible: boolean;
  mensaje?: string;
}> {
  const reservas = await listReservasCola();
  return { reservas, disponible: true };
}

export { updateReservaEstado };
