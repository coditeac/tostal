"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
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

const accesos = [
  { href: "/produccion", label: "Producción", hint: "Cola y descuento" },
  { href: "/inventario", label: "Inventario", hint: "Movimientos" },
  { href: "/compras", label: "Compras", hint: "Lista + proveedor" },
  { href: "/gastos", label: "Gastos", hint: "Registro y resumen" },
  { href: "/caja", label: "Caja", hint: "Pedir → pagar → ficha" },
  { href: "/avisos", label: "Avisos WhatsApp", hint: "Cola manual" },
  { href: "/costos", label: "Costos", hint: "Márgenes por receta" },
  { href: "/panel/calendario", label: "Menú del día", hint: "Activar + hora límite" },
  { href: "/panel/reservas", label: "Reservas", hint: "Cola e insumos" },
  { href: "/panel/usuarios", label: "Personal", hint: "Admin, cocina, caja" },
] as const;

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
    return <p className="loading-pulse text-sm text-muted-foreground">Cargando panel…</p>;
  }

  const { config, pedidosHoy, activosCount, totalVentas, insumosBajos, avisosPendientes } =
    data;
  const bajos = insumosBajos;

  return (
    <div className="space-y-10 rise-in">
      <section>
        <p className="text-xs font-medium tracking-wide text-muted-foreground">
          Hoy en Tostal
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">
          {config.marca}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{config.eslogan}</p>

        <div className="mt-6 flex gap-8 border-y border-border py-5">
          <div>
            <p className="text-xs text-muted-foreground">Pedidos</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
              {activosCount}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ventas</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
              {formatoMoneda(totalVentas, config.moneda)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge
            variant={config.canalRemotoActivo ? "success-light" : "secondary"}
            radius="default"
          >
            Remoto: {config.canalRemotoActivo ? "activo" : "apagado"}
          </Badge>
          <Badge
            variant={config.canalMostradorActivo ? "success-light" : "secondary"}
            radius="default"
          >
            Mostrador: {config.canalMostradorActivo ? "activo" : "apagado"}
          </Badge>
          {avisosPendientes > 0 && (
            <Badge variant="warning" radius="default">
              {avisosPendientes} avisos
            </Badge>
          )}
        </div>
      </section>

      {bajos.length > 0 && (
        <section className="border-y border-alerta/25 py-4">
          <h2 className="text-sm font-semibold text-alerta">Falta stock</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
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

      <section>
        <h2 className="section-title">Accesos</h2>
        <ul className="list-plain mt-3">
          {accesos.map((a) => {
            const hint =
              a.href === "/inventario" && bajos.length > 0
                ? `${bajos.length} bajo mínimo`
                : a.href === "/avisos"
                  ? `${avisosPendientes} pendientes (manual)`
                  : a.hint;
            return (
              <li key={a.href}>
                <Link
                  href={a.href}
                  className="list-row active:opacity-70"
                >
                  <div>
                    <p className="font-medium tracking-tight">{a.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
                  </div>
                  <span className="text-muted-foreground" aria-hidden>
                    →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="section-title">Últimos pedidos</h2>
          <Link href="/panel/pedidos" className="text-sm font-semibold text-miel">
            Ver todos
          </Link>
        </div>
        {pedidosHoy.length === 0 ? (
          <p className="empty-state">
            Aún no hay pedidos para hoy. Cuando lleguen, aparecen aquí.
          </p>
        ) : (
          <ul className="list-plain mt-3">
            {pedidosHoy.slice(0, 5).map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 py-3.5 text-sm"
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
