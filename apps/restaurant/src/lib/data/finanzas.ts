"use client";

import { createClient } from "@/lib/supabase/client";

const CAT_GASTO = ["compras", "nomina", "servicios", "renta", "otros"];
const CAT_INGRESO = ["ventas", "anticipos", "otros"];

export async function loadFinanzas() {
  const supabase = createClient();
  const [{ data: gastos, error: e1 }, { data: ingresos, error: e2 }] =
    await Promise.all([
      supabase
        .from("gastos")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("ingresos")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);

  const gastosUi = (gastos || []).map((g) => ({
    id: g.id,
    categoria: g.categoria || "otros",
    monto: Number(g.monto) || 0,
    fecha: (g.created_at || "").slice(0, 10),
    metodoPago: null as string | null,
    notas: g.concepto,
    tienda: g.tienda,
  }));
  const ingresosUi = (ingresos || []).map((i) => ({
    id: i.id,
    categoria: i.fuente || "ventas",
    monto: Number(i.monto) || 0,
    fecha: (i.created_at || "").slice(0, 10),
    metodoPago: null as string | null,
    notas: i.concepto,
    pedidoId: i.pedido_id,
    reservaId: i.reserva_id,
  }));

  const totalGastos = gastosUi.reduce((a, g) => a + g.monto, 0);
  const totalIngresos = ingresosUi.reduce((a, i) => a + i.monto, 0);

  return {
    gastos: gastosUi,
    ingresos: ingresosUi,
    resumen: {
      totalGastos,
      totalIngresos,
      balance: totalIngresos - totalGastos,
      desde: "",
      hasta: "",
      ventasPedidos: 0,
      anticiposReservas: 0,
    },
    categorias_gasto: CAT_GASTO,
    categorias_ingreso: CAT_INGRESO,
  };
}

export async function createGasto(input: {
  categoria: string;
  montoPesos: number;
  notas?: string;
  tienda?: string | null;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("gastos")
    .insert({
      concepto: input.notas?.trim() || input.categoria,
      monto: Math.round(Number(input.montoPesos) * 100),
      categoria: input.categoria,
      tienda: input.tienda ?? null,
      created_by: user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createIngreso(input: {
  categoria: string;
  montoPesos: number;
  notas?: string;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("ingresos")
    .insert({
      concepto: input.notas?.trim() || input.categoria,
      monto: Math.round(Number(input.montoPesos) * 100),
      fuente: input.categoria,
      created_by: user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteGasto(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("gastos").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteIngreso(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("ingresos").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
