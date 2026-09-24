"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/reui/badge";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { formatoMoneda } from "@/lib/format";

type Resumen = {
  config: {
    marca: string;
    eslogan: string;
    moneda: string;
    canalRemotoActivo: boolean;
    canalMostradorActivo: boolean;
  };
  pedidosHoy: Array<{
    id: string;
    codigo: string;
    clienteNombre: string;
    estado: string;
    total: number;
  }>;
  activosCount: number;
  totalVentas: number;
  insumosBajos: Array<{
    id: string;
    nombre: string;
    stockActual: number;
    stockMinimo: number;
    unidad: string;
  }>;
  avisosPendientes: number;
};

export default function PanelHome() {
  const [data, setData] = useState<Resumen | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/panel/resumen");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "No se pudo cargar el panel");
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p className="text-sm text-alerta">
        {error}. ¿Está corriendo la API Nest (`NEXT_PUBLIC_API_URL`)?
      </p>
    );
  }
  if (!data) {
    return <p className="text-sm text-muted-foreground">Cargando panel…</p>;
  }

  const { config, pedidosHoy, activosCount, totalVentas, insumosBajos, avisosPendientes } =
    data;
  const bajos = insumosBajos;

  return (
    <div className="space-y-5 rise-in">
      <section className="surface p-5">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/tostal-logo-marca.png"
            alt=""
            width={140}
            height={60}
            className="ops-mark mt-0.5"
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Hoy en Tostal
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-cacao">
              {config.marca}
            </h1>
            <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {config.eslogan}
            </p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-arena p-3.5">
            <p className="text-xs text-muted-foreground">Pedidos de hoy</p>
            <p className="text-2xl font-semibold tabular-nums">{activosCount}</p>
          </div>
          <div className="rounded-xl bg-arena p-3.5">
            <p className="text-xs text-muted-foreground">Ventas del día</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatoMoneda(totalVentas, config.moneda)}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge
            variant={config.canalRemotoActivo ? "success-light" : "secondary"}
            radius="full"
          >
            Remoto: {config.canalRemotoActivo ? "activo" : "apagado"}
          </Badge>
          <Badge
            variant={config.canalMostradorActivo ? "success-light" : "secondary"}
            radius="full"
          >
            Mostrador: {config.canalMostradorActivo ? "activo" : "apagado"}
          </Badge>
          {avisosPendientes > 0 && (
            <Badge variant="warning" radius="full">
              {avisosPendientes} avisos
            </Badge>
          )}
        </div>
      </section>

      {bajos.length > 0 && (
        <section className="surface border-alerta/40 p-4">
          <h2 className="font-semibold text-alerta">Falta stock</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {bajos.slice(0, 4).map((i) => (
              <li key={i.id}>
                {i.nombre}: {i.stockActual} {i.unidad} (mín. {i.stockMinimo})
              </li>
            ))}
          </ul>
          <Link
            href="/panel/insumos"
            className="mt-3 inline-block text-sm font-semibold text-miel"
          >
            Ver insumos →
          </Link>
        </section>
      )}

      <section className="grid grid-cols-2 gap-2.5">
        <Link href="/produccion" className="surface p-3.5 active:bg-arena/50">
          <p className="font-semibold">Producción</p>
          <p className="mt-1 text-xs text-muted-foreground">Cola y descuento</p>
        </Link>
        <Link href="/inventario" className="surface p-3.5 active:bg-arena/50">
          <p className="font-semibold">Inventario</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {bajos.length > 0 ? `${bajos.length} bajo mínimo` : "Movimientos"}
          </p>
        </Link>
        <Link href="/compras" className="surface p-3.5 active:bg-arena/50">
          <p className="font-semibold">Compras</p>
          <p className="mt-1 text-xs text-muted-foreground">Lista + proveedor</p>
        </Link>
        <Link href="/gastos" className="surface p-3.5 active:bg-arena/50">
          <p className="font-semibold">Gastos</p>
          <p className="mt-1 text-xs text-muted-foreground">Registro y resumen</p>
        </Link>
        <Link href="/caja" className="surface p-3.5 active:bg-arena/50">
          <p className="font-semibold">Caja</p>
          <p className="mt-1 text-xs text-muted-foreground">Pedir → pagar → ficha</p>
        </Link>
        <Link href="/avisos" className="surface p-3.5 active:bg-arena/50">
          <p className="font-semibold">Avisos WhatsApp</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {avisosPendientes} pendientes (manual)
          </p>
        </Link>
        <Link href="/costos" className="surface p-3.5 active:bg-arena/50">
          <p className="font-semibold">Costos</p>
          <p className="mt-1 text-xs text-muted-foreground">Márgenes por receta</p>
        </Link>
        <Link href="/panel/calendario" className="surface p-3.5 active:bg-arena/50">
          <p className="font-semibold">Calendario</p>
          <p className="mt-1 text-xs text-muted-foreground">Disponibilidad</p>
        </Link>
        <Link href="/panel/usuarios" className="surface p-3.5 active:bg-arena/50">
          <p className="font-semibold">Personal</p>
          <p className="mt-1 text-xs text-muted-foreground">Roles admin/cocina/caja</p>
        </Link>
      </section>

      <section className="surface p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Últimos pedidos de hoy</h2>
          <Link href="/panel/pedidos" className="text-sm font-semibold text-miel">
            Ver todos
          </Link>
        </div>
        {pedidosHoy.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Aún no hay pedidos para hoy. Cuando lleguen, aparecen aquí.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {pedidosHoy.slice(0, 5).map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="font-medium">{p.codigo}</p>
                  <p className="truncate text-muted-foreground">
                    {p.clienteNombre} · {p.estado.replace("_", " ")}
                  </p>
                </div>
                <p className="shrink-0 font-semibold tabular-nums">
                  {formatoMoneda(p.total, config.moneda)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
