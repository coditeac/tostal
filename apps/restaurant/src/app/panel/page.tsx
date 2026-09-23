import Link from "next/link";
import { listPedidos } from "@/lib/pedidos";
import { listInsumos } from "@/lib/catalogo";
import { getConfigPublica } from "@/lib/config";
import { getDb } from "@/lib/db";
import { formatoMoneda, hoyISO } from "@/lib/utils";
import { ensureSeed } from "@/lib/seed";

export default async function PanelHome() {
  ensureSeed();
  const hoy = hoyISO();
  const pedidosHoy = listPedidos({ fecha: hoy });
  const insumos = listInsumos();
  const bajos = insumos.filter((i) => i.stockActual <= i.stockMinimo);
  const config = getConfigPublica();
  const avisosPendientes = (
    getDb()
      .prepare(
        `SELECT COUNT(*) as c FROM avisos_whatsapp WHERE estado = 'pendiente'`
      )
      .get() as { c: number }
  ).c;

  const activos = pedidosHoy.filter((p) => p.estado !== "cancelado");
  const totalVentas = activos.reduce((a, p) => a + p.total, 0);

  return (
    <div className="space-y-4 rise-in">
      <section className="surface p-5">
        <p className="text-sm text-muted">Hoy en Tostal</p>
        <h1 className="font-display mt-1 text-3xl text-cacao">
          {config.marca}
        </h1>
        <p className="text-sm text-muted">{config.eslogan}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-arena/70 p-3">
            <p className="text-xs text-muted">Pedidos de hoy</p>
            <p className="text-2xl font-semibold">{activos.length}</p>
          </div>
          <div className="rounded-2xl bg-arena/70 p-3">
            <p className="text-xs text-muted">Ventas del día</p>
            <p className="text-2xl font-semibold">
              {formatoMoneda(totalVentas, config.moneda)}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-white px-3 py-1 border border-border">
            Remoto: {config.canalRemotoActivo ? "activo" : "apagado"}
          </span>
          <span className="rounded-full bg-white px-3 py-1 border border-border">
            Mostrador: {config.canalMostradorActivo ? "activo" : "apagado"}
          </span>
        </div>
      </section>

      {bajos.length > 0 && (
        <section className="surface border-alerta/30 p-4">
          <h2 className="font-semibold text-alerta">Falta stock</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {bajos.slice(0, 4).map((i) => (
              <li key={i.id}>
                {i.nombre}: {i.stockActual} {i.unidad} (mín. {i.stockMinimo})
              </li>
            ))}
          </ul>
          <Link href="/panel/insumos" className="mt-3 inline-block text-sm font-semibold text-miel-dark">
            Ver insumos →
          </Link>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3">
        <Link href="/panel/pedidos" className="surface p-4">
          <p className="font-semibold">Pedidos</p>
          <p className="mt-1 text-sm text-muted">Cola de hoy</p>
        </Link>
        <Link href="/panel/calendario" className="surface p-4">
          <p className="font-semibold">Calendario</p>
          <p className="mt-1 text-sm text-muted">Disponibilidad y deadline</p>
        </Link>
        <Link href="/panel/productos" className="surface p-4">
          <p className="font-semibold">Menú</p>
          <p className="mt-1 text-sm text-muted">Productos y recetas</p>
        </Link>
        <Link href="/panel/whatsapp" className="surface p-4">
          <p className="font-semibold">Avisos WhatsApp</p>
          <p className="mt-1 text-sm text-muted">
            {avisosPendientes} pendientes
          </p>
        </Link>
      </section>

      <section className="surface p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Últimos pedidos de hoy</h2>
          <Link href="/panel/pedidos" className="text-sm text-miel-dark">
            Ver todos
          </Link>
        </div>
        {pedidosHoy.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Aún no hay pedidos para hoy. Cuando lleguen, aparecen aquí.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {pedidosHoy.slice(0, 5).map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{p.codigo}</p>
                  <p className="text-muted">
                    {p.clienteNombre} · {p.estado.replace("_", " ")}
                  </p>
                </div>
                <p className="font-semibold">
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
