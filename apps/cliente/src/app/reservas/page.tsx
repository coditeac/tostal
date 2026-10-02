"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { SiteHeader } from "@/components/site-header";
import {
  crearReserva,
  fechaMinimaReservaISO,
  fetchReservasProductos,
  formatoMoneda,
  labelFecha,
} from "@/lib/api";
import {
  calcularAnticipo,
  labelAnticipo,
  labelCantidadMinima,
  labelDiasMinimos,
  maxDiasMinimos,
  RESERVA_DIAS_MINIMOS_DEFAULT,
  type ReservaProducto,
} from "@/lib/contract";
import { METODO_PAGO } from "@/lib/labels";
import type { MetodoPago } from "@tostal/shared/types";

type LineaLocal = { productoId: string; cantidad: number };

export default function ReservasPage() {
  const [productos, setProductos] = useState<ReservaProducto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiPendiente, setApiPendiente] = useState(false);

  const [fecha, setFecha] = useState(() =>
    fechaMinimaReservaISO(RESERVA_DIAS_MINIMOS_DEFAULT)
  );
  const [lineas, setLineas] = useState<LineaLocal[]>([]);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [notas, setNotas] = useState("");
  const [metodoPago, setMetodoPago] = useState<
    Extract<MetodoPago, "transferencia" | "stripe">
  >("transferencia");
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState<{
    codigo: string;
    anticipo: number;
    total: number;
    fecha: string;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      setApiPendiente(false);
      try {
        const list = await fetchReservasProductos();
        if (!alive) return;
        setProductos(list);
      } catch (e) {
        if (!alive) return;
        const status = (e as { status?: number })?.status;
        const msg = e instanceof Error ? e.message : "Error al cargar reservas";
        if (
          status === 404 ||
          status === 501 ||
          /404|not found|Cannot GET|no encontr/i.test(msg)
        ) {
          setApiPendiente(true);
          setProductos([]);
        } else {
          setError(msg);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const byId = useMemo(() => {
    const m = new Map<string, ReservaProducto>();
    for (const p of productos) m.set(p.id, p);
    return m;
  }, [productos]);

  const productosEnCarrito = useMemo(
    () =>
      lineas
        .map((l) => byId.get(l.productoId))
        .filter((p): p is ReservaProducto => Boolean(p)),
    [lineas, byId]
  );

  /** Si hay líneas, exige el máximo N de esas; si no, el del catálogo (o default). */
  const diasMinimosEfectivos = useMemo(() => {
    if (productosEnCarrito.length > 0) {
      return maxDiasMinimos(productosEnCarrito);
    }
    return maxDiasMinimos(productos, RESERVA_DIAS_MINIMOS_DEFAULT);
  }, [productosEnCarrito, productos]);

  const minFecha = useMemo(
    () => fechaMinimaReservaISO(diasMinimosEfectivos),
    [diasMinimosEfectivos]
  );

  useEffect(() => {
    setFecha((prev) => (prev < minFecha ? minFecha : prev));
  }, [minFecha]);

  const total = useMemo(() => {
    return lineas.reduce((acc, l) => {
      const p = byId.get(l.productoId);
      return acc + (p ? p.precio * l.cantidad : 0);
    }, 0);
  }, [lineas, byId]);

  const anticipo = useMemo(() => {
    if (lineas.length === 0) return 0;
    return lineas.reduce((acc, l) => {
      const p = byId.get(l.productoId);
      if (!p) return acc;
      const sub = p.precio * l.cantidad;
      return acc + calcularAnticipo(sub, p.anticipoTipo, p.anticipoValor);
    }, 0);
  }, [lineas, byId]);

  const lineasBajoMinimo = useMemo(() => {
    return lineas
      .map((l) => {
        const p = byId.get(l.productoId);
        if (!p) return null;
        if (l.cantidad >= p.reservaCantidadMinima) return null;
        return {
          nombre: p.nombre,
          cantidad: l.cantidad,
          minimo: p.reservaCantidadMinima,
        };
      })
      .filter(
        (x): x is { nombre: string; cantidad: number; minimo: number } =>
          Boolean(x)
      );
  }, [lineas, byId]);

  const fechaInvalida = Boolean(fecha && fecha < minFecha);

  const bloqueoReglas = useMemo(() => {
    if (fechaInvalida) {
      return `La fecha debe ser desde el ${labelFecha(minFecha)} (${labelDiasMinimos(diasMinimosEfectivos).toLowerCase()}).`;
    }
    if (lineasBajoMinimo.length > 0) {
      const detalle = lineasBajoMinimo
        .map((x) => `${x.nombre}: mínimo ${x.minimo}`)
        .join("; ");
      return `Ajusta las cantidades: ${detalle}.`;
    }
    return null;
  }, [fechaInvalida, minFecha, diasMinimosEfectivos, lineasBajoMinimo]);

  function qtyOf(id: string) {
    return lineas.find((l) => l.productoId === id)?.cantidad || 0;
  }

  function setQty(id: string, cantidad: number) {
    const p = byId.get(id);
    const minimo = p?.reservaCantidadMinima ?? 1;
    setLineas((prev) => {
      const rest = prev.filter((l) => l.productoId !== id);
      if (cantidad <= 0) return rest;
      // No permitir cantidades entre 1 y (mínimo−1): saltar al mínimo.
      const next = cantidad < minimo ? minimo : cantidad;
      return [...rest, { productoId: id, cantidad: next }];
    });
  }

  function agregarProducto(id: string) {
    const p = byId.get(id);
    const minimo = p?.reservaCantidadMinima ?? 1;
    setQty(id, minimo);
  }

  function decrementar(id: string) {
    const p = byId.get(id);
    const minimo = p?.reservaCantidadMinima ?? 1;
    const actual = qtyOf(id);
    if (actual <= minimo) {
      setLineas((prev) => prev.filter((l) => l.productoId !== id));
      return;
    }
    setQty(id, actual - 1);
  }

  async function confirmar() {
    if (lineas.length === 0 || bloqueoReglas) return;
    setEnviando(true);
    setError(null);
    try {
      const data = await crearReserva({
        fecha,
        fechaEntrega: fecha,
        modoEntrega: "retiro",
        clienteNombre: nombre.trim(),
        clienteTelefono: telefono.trim(),
        clienteEmail: email.trim() || null,
        metodoPago,
        notas: notas.trim() || null,
        lineas: lineas.map((l) => ({
          productoId: l.productoId,
          cantidad: l.cantidad,
        })),
      });
      setExito({
        codigo: data.reserva.codigo,
        anticipo: data.reserva.anticipoMonto,
        total: data.reserva.total,
        fecha: data.reserva.fechaEntrega,
      });
      setLineas([]);
      if (data.reserva.checkoutUrl) {
        window.location.href = data.reserva.checkoutUrl;
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo crear la reserva"
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="page-shell">
      <div className="px-6 pt-5">
        <SiteHeader />
      </div>

      <main className="space-y-10 px-6 pb-36 pt-6">
        <section className="section-block rise-in">
          <p className="text-xs font-medium tracking-wide text-muted-foreground">
            Bajo pedido
          </p>
          <h1 className="section-title mt-1">Reservas</h1>
          <p className="section-lead">
            Elige productos disponibles para reservar, la fecha y paga el anticipo.
          </p>
        </section>

        {exito && (
          <Alert className="border-ok/30 bg-[color-mix(in_oklab,var(--tostal-ok,#2F6B52)_12%,white)]">
            <AlertDescription>
              Reserva <span className="font-semibold">{exito.codigo}</span> para{" "}
              {labelFecha(exito.fecha)}. Anticipo{" "}
              {formatoMoneda(exito.anticipo)} de {formatoMoneda(exito.total)}.
              Te confirmamos por WhatsApp o email.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {bloqueoReglas && lineas.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>{bloqueoReglas}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        ) : apiPendiente ? (
          <p className="empty-state">
            Las reservas estarán disponibles en cuanto cocina active productos
            bajo pedido. Mientras tanto, pide del{" "}
            <Link href="/" className="font-semibold text-miel">
              menú de hoy
            </Link>
            .
          </p>
        ) : productos.length === 0 ? (
          <p className="empty-state">
            No hay productos con reserva habilitada por ahora.
          </p>
        ) : (
          <>
            <section className="section-block space-y-3">
              <Label htmlFor="fecha-reserva">Fecha de la reserva</Label>
              <Input
                id="fecha-reserva"
                type="date"
                min={minFecha}
                value={fecha}
                onChange={(e) => setFecha(e.target.value || minFecha)}
                className="max-w-xs"
                aria-invalid={fechaInvalida || undefined}
              />
              <p className="text-xs text-muted-foreground">
                {labelDiasMinimos(diasMinimosEfectivos)} · desde{" "}
                {labelFecha(minFecha)}
                {fecha ? ` · elegida ${labelFecha(fecha)}` : ""}
              </p>
              {fechaInvalida && (
                <p className="text-xs text-destructive">
                  Esa fecha es demasiado pronto. Elige desde el{" "}
                  {labelFecha(minFecha)}.
                </p>
              )}
            </section>

            <section className="section-block">
              <h2 className="section-title">Productos</h2>
              <ul className="list-plain mt-2">
                {productos.map((p, idx) => {
                  const qty = qtyOf(p.id);
                  const bajoMinimo =
                    qty > 0 && qty < p.reservaCantidadMinima;
                  return (
                    <li
                      key={p.id}
                      className="rise-in flex items-center gap-3.5 py-4"
                      style={{ animationDelay: `${40 + idx * 25}ms` }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold leading-snug tracking-tight">
                          {p.nombre}
                        </p>
                        {p.descripcion && (
                          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                            {p.descripcion}
                          </p>
                        )}
                        <p className="mt-2 text-[0.95rem] font-semibold tabular-nums">
                          {formatoMoneda(p.precio)}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {labelAnticipo(
                            p.anticipoTipo,
                            p.anticipoValor,
                            formatoMoneda
                          )}
                          {" · "}
                          {labelCantidadMinima(p.reservaCantidadMinima)}
                          {p.reservaDiasMinimos > 0
                            ? ` · ${p.reservaDiasMinimos} día${p.reservaDiasMinimos === 1 ? "" : "s"} de anticipación`
                            : ""}
                        </p>
                        {bajoMinimo && (
                          <p className="mt-1 text-[11px] text-destructive">
                            Mínimo {p.reservaCantidadMinima} unidades para
                            reservar.
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {qty > 0 ? (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              onClick={() => decrementar(p.id)}
                              aria-label="Quitar uno"
                            >
                              <Minus size={16} />
                            </Button>
                            <span className="w-7 text-center font-semibold tabular-nums">
                              {qty}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              onClick={() => setQty(p.id, qty + 1)}
                              aria-label="Agregar uno"
                            >
                              <Plus size={16} />
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => agregarProducto(p.id)}
                          >
                            {p.reservaCantidadMinima > 1
                              ? `Agregar ${p.reservaCantidadMinima}`
                              : "Agregar"}
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            {lineas.length > 0 && (
              <>
                <Separator />

                <section className="space-y-4">
                  <h2 className="section-title">Tus datos</h2>
                  <div className="space-y-2">
                    <Label htmlFor="r-nombre">Nombre</Label>
                    <Input
                      id="r-nombre"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      autoComplete="name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="r-tel">WhatsApp / teléfono</Label>
                    <Input
                      id="r-tel"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      inputMode="tel"
                      autoComplete="tel"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="r-email">Email (confirmación)</Label>
                    <Input
                      id="r-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                      placeholder="tunombre@correo.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="r-notas">Notas (opcional)</Label>
                    <Textarea
                      id="r-notas"
                      className="min-h-16"
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      placeholder="Detalles del pedido, alergias…"
                    />
                  </div>
                </section>

                <Separator />

                <section className="space-y-3">
                  <h2 className="section-title">Anticipo y pago</h2>
                  {(
                    [
                      ["transferencia", "Te enviamos los datos; confirmamos el anticipo a mano"],
                      ["stripe", "Tarjeta en línea (anticipo)"],
                    ] as const
                  ).map(([value, hint]) => (
                    <label
                      key={value}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3.5 text-sm transition-colors ${
                        metodoPago === value
                          ? "border-miel bg-rosa/40"
                          : "border-border bg-transparent"
                      }`}
                    >
                      <input
                        type="radio"
                        name="pago-reserva"
                        className="mt-1"
                        checked={metodoPago === value}
                        onChange={() => setMetodoPago(value)}
                      />
                      <span>
                        <span className="font-semibold">
                          {METODO_PAGO[value]}
                        </span>
                        <span className="mt-0.5 block text-muted-foreground">
                          {hint}
                        </span>
                      </span>
                    </label>
                  ))}

                  <div className="pt-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total pedido</span>
                      <span className="tabular-nums">{formatoMoneda(total)}</span>
                    </div>
                    <div className="mt-1.5 flex justify-between font-semibold">
                      <span>Anticipo ahora</span>
                      <span className="tabular-nums text-miel">
                        {formatoMoneda(anticipo)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      El resto se paga al retirar o entregar.
                    </p>
                  </div>
                </section>

                <div className="cart-bar">
                  <Button
                    type="button"
                    size="lg"
                    className="mx-auto flex w-full max-w-lg"
                    disabled={
                      enviando ||
                      Boolean(bloqueoReglas) ||
                      !nombre.trim() ||
                      !telefono.trim() ||
                      !email.trim() ||
                      !fecha ||
                      lineas.length === 0
                    }
                    onClick={confirmar}
                  >
                    {enviando ? (
                      <>
                        <Spinner />
                        Reservando…
                      </>
                    ) : bloqueoReglas ? (
                      "Revisa fecha o cantidades"
                    ) : (
                      `Reservar · anticipo ${formatoMoneda(anticipo)}`
                    )}
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
