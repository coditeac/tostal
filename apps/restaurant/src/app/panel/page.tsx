import Link from "next/link";
import { listPedidos } from "@/lib/pedidos";
import { listInsumos } from "@/lib/catalogo";
import { getConfigPublica } from "@/lib/config";
import { sqlGet } from "@/lib/db";
import { formatoMoneda, hoyISO } from "@/lib/utils";
import { ensureSeed } from "@/lib/seed";

export default async function PanelHome() {
  await ensureSeed();
  const hoy = hoyISO();
  const pedidosHoy = await listPedidos({ fecha: hoy });
  const insumos = await listInsumos();
  const bajos = insumos.filter((i) => i.stockActual <= i.stockMinimo);
  const config = await getConfigPublica();
  const avisosPendientes =
    (
      await sqlGet<{ c: number }>(
        `SELECT COUNT(*) as c FROM avisos_whatsapp WHERE estado = 'pendiente'`
      )
    )?.c ?? 0;

  const activos = pedidosHoy.filter((p) => p.estado !== "cancelado");
  const totalVentas = activos.reduce((a, p) => a + p.total, 0);

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
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              Hoy en Tostal
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-cacao">
              {config.marca}
            </h1>
            <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-muted">
              {config.eslogan}
            </p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-arena p-3.5">
            <p className="text-xs text-muted">Pedidos de hoy</p>
            <p className="text-2xl font-semibold tabular-nums">
              {activos.length}
            </p>
          </div>
          <div className="rounded-xl bg-arena p-3.5">
            <p className="text-xs text-muted">Ventas del día</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatoMoneda(totalVentas, config.moneda)}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="badge">
            Remoto: {config.canalRemotoActivo ? "activo" : "apagado"}
          </span>
          <span className="badge">
            Mostrador: {config.canalMostradorActivo ? "activo" : "apagado"}
          </span>
          {avisosPendientes > 0 && (
            <span className="badge-accent badge">
              {avisosPendientes} avisos
            </span>
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
          <p className="mt-1 text-xs text-muted">Cola y descuento</p>
        </Link>
        <Link href="/inventario" className="surface p-3.5 active:bg-arena/50">
          <p className="font-semibold">Inventario</p>
          <p className="mt-1 text-xs text-muted">
            {bajos.length > 0
              ? `${bajos.length} bajo mínimo`
              : "Movimientos"}
          </p>
        </Link>
        <Link href="/compras" className="surface p-3.5 active:bg-arena/50">
          <p className="font-semibold">Compras</p>
          <p className="mt-1 text-xs text-muted">Lista + proveedor</p>
        </Link>
        <Link href="/gastos" className="surface p-3.5 active:bg-arena/50">
          <p className="font-semibold">Gastos</p>
          <p className="mt-1 text-xs text-muted">Registro y resumen</p>
        </Link>
        <Link href="/caja" className="surface p-3.5 active:bg-arena/50">
          <p className="font-semibold">Caja</p>
          <p className="mt-1 text-xs text-muted">Pedir → pagar → ficha</p>
        </Link>
        <Link href="/avisos" className="surface p-3.5 active:bg-arena/50">
          <p className="font-semibold">Avisos WhatsApp</p>
          <p className="mt-1 text-xs text-muted">
            {avisosPendientes} pendientes
          </p>
        </Link>
        <Link href="/costos" className="surface p-3.5 active:bg-arena/50">
          <p className="font-semibold">Costos</p>
          <p className="mt-1 text-xs text-muted">Márgenes por receta</p>
        </Link>
        <Link
          href="/panel/calendario"
          className="surface p-3.5 active:bg-arena/50"
        >
          <p className="font-semibold">Calendario</p>
          <p className="mt-1 text-xs text-muted">Disponibilidad</p>
        </Link>
      </section>

      <section className="surface p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Últimos pedidos de hoy</h2>
          <Link
            href="/panel/pedidos"
            className="text-sm font-semibold text-miel"
          >
            Ver todos
          </Link>
        </div>
        {pedidosHoy.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
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
                  <p className="truncate text-muted">
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
