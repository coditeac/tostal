"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCart } from "@/components/cart-provider";
import {
  crearPedido,
  fetchMenu,
  formatoMoneda,
  labelFecha,
} from "@/lib/api";
import { METODO_PAGO } from "@/lib/labels";
import type { MenuDiaResponse, MetodoPago, ModoEntrega } from "@tostal/shared/types";

export default function CarritoPage() {
  const cart = useCart();
  const router = useRouter();
  const [menu, setMenu] = useState<MenuDiaResponse | null>(null);
  const [modo, setModo] = useState<ModoEntrega>("retiro");
  const [zonaId, setZonaId] = useState("");
  const [metodoPago, setMetodoPago] = useState<
    Extract<MetodoPago, "transferencia" | "contra_entrega" | "stripe">
  >("transferencia");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!cart.fecha) return;
    let alive = true;
    fetchMenu(cart.fecha)
      .then((m) => {
        if (!alive) return;
        setMenu(m);
        if (m.zonas[0]) setZonaId(m.zonas[0].id);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "Error");
      });
    return () => {
      alive = false;
    };
  }, [cart.fecha]);

  const costoEnvio = useMemo(() => {
    if (modo !== "envio") return 0;
    return menu?.zonas.find((z) => z.id === zonaId)?.costoEnvio || 0;
  }, [modo, zonaId, menu]);

  const total = cart.subtotal + costoEnvio;
  const bloqueado =
    menu?.abierto === false || menu?.deadlineVigente === false;

  async function confirmar() {
    if (!cart.fecha || cart.items.length === 0) return;
    if (bloqueado) {
      setError("Ya cerramos pedidos para este día.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await crearPedido({
        fechaEntrega: cart.fecha,
        modoEntrega: modo,
        zonaId: modo === "envio" ? zonaId : null,
        clienteNombre: nombre.trim(),
        clienteTelefono: telefono.trim(),
        direccion: modo === "envio" ? direccion.trim() : null,
        metodoPago,
        notas: notas.trim() || null,
        lineas: cart.items.map((i) => ({
          productoId: i.productoId,
          cantidad: i.cantidad,
        })),
      });
      cart.clear();
      const qs =
        metodoPago === "stripe" ? "?pago=stripe" : "";
      router.push(`/pedido/${data.pedido.codigo}${qs}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el pedido");
    } finally {
      setLoading(false);
    }
  }

  if (!cart.fecha) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <p className="text-muted-foreground">Elige primero una fecha en el menú.</p>
        <Button asChild className="mt-4">
          <Link href="/">Ir al menú</Link>
        </Button>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-5 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Tu carrito</h1>
        <p className="mt-2 text-muted-foreground">Está vacío. Agrega algo del menú.</p>
        <Button asChild className="mt-5">
          <Link href="/">Ver menú</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="page-shell px-5 pb-32 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Tu carrito</h1>
        <Link href="/" className="text-sm font-semibold text-miel">
          Seguir pidiendo
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Entrega/retiro: {labelFecha(cart.fecha)}
      </p>

      {bloqueado && (
        <Alert className="mt-3 border-alerta/40 bg-amber-50 text-alerta">
          <AlertDescription>
            Ya cerramos pedidos para este día. Elige otra fecha en el menú.
          </AlertDescription>
        </Alert>
      )}

      <ul className="mt-4 space-y-3">
        {cart.items.map((item) => (
          <li
            key={item.productoId}
            className="surface flex items-center justify-between gap-3 p-3"
          >
            <div>
              <p className="font-semibold">{item.nombre}</p>
              <p className="text-sm text-muted-foreground">
                {formatoMoneda(item.precio)} c/u
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="rounded-full"
                onClick={() => cart.setQty(item.productoId, item.cantidad - 1)}
                aria-label="Quitar uno"
              >
                {item.cantidad === 1 ? (
                  <Trash2 size={16} />
                ) : (
                  <Minus size={16} />
                )}
              </Button>
              <span className="w-6 text-center font-semibold tabular-nums">
                {item.cantidad}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="rounded-full"
                onClick={() => cart.setQty(item.productoId, item.cantidad + 1)}
                aria-label="Agregar uno"
              >
                <Plus size={16} />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <section className="surface mt-4 space-y-3 p-4">
        <h2 className="font-semibold">Entrega</h2>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={modo === "retiro" ? "default" : "outline"}
            className={modo === "retiro" ? "bg-cacao text-crema hover:bg-cacao/90" : ""}
            onClick={() => setModo("retiro")}
          >
            Retiro
          </Button>
          <Button
            type="button"
            variant={modo === "envio" ? "default" : "outline"}
            className={modo === "envio" ? "bg-cacao text-crema hover:bg-cacao/90" : ""}
            onClick={() => setModo("envio")}
          >
            Envío
          </Button>
        </div>
        {modo === "retiro" && menu?.config.direccionRetiro && (
          <p className="text-sm text-muted-foreground">{menu.config.direccionRetiro}</p>
        )}
        {modo === "envio" && (
          <>
            {(menu?.zonas.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">
                Por ahora no hay zonas de envío. Puedes retirar en tienda.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="zona">Zona</Label>
                  <Select value={zonaId || undefined} onValueChange={setZonaId}>
                    <SelectTrigger id="zona" className="h-11 w-full min-h-[var(--tap)]">
                      <SelectValue placeholder="Elige zona" />
                    </SelectTrigger>
                    <SelectContent>
                      {(menu?.zonas || []).map((z) => (
                        <SelectItem key={z.id} value={z.id}>
                          {z.nombre} · {formatoMoneda(z.costoEnvio)}
                          {z.cobertura ? ` — ${z.cobertura}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="direccion">Dirección</Label>
                  <Input
                    id="direccion"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    placeholder="Calle, número, colonia…"
                    autoComplete="street-address"
                  />
                </div>
              </>
            )}
          </>
        )}
      </section>

      <section className="surface mt-4 space-y-3 p-4">
        <h2 className="font-semibold">Tus datos</h2>
        <div className="space-y-2">
          <Label htmlFor="nombre">Nombre</Label>
          <Input
            id="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoComplete="name"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="telefono">WhatsApp / teléfono</Label>
          <Input
            id="telefono"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            inputMode="tel"
            autoComplete="tel"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="notas">Notas (opcional)</Label>
          <Textarea
            id="notas"
            className="min-h-16"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Alergias, detalles de decoración…"
          />
        </div>
      </section>

      <section className="surface mt-4 space-y-3 p-4">
        <h2 className="font-semibold">Pago</h2>
        {(
          [
            ["transferencia", "Te enviamos los datos; confirmamos a mano"],
            ["contra_entrega", "Pagas al recibir o retirar"],
            ["stripe", "Tarjeta en línea (si no hay Stripe, se simula el pago)"],
          ] as const
        ).map(([value, hint]) => (
          <label
            key={value}
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 text-sm ${
              metodoPago === value
                ? "border-miel bg-rosa/30"
                : "border-border bg-white"
            }`}
          >
            <input
              type="radio"
              name="pago"
              className="mt-1"
              checked={metodoPago === value}
              onChange={() => setMetodoPago(value)}
            />
            <span>
              <span className="font-semibold">{METODO_PAGO[value]}</span>
              <span className="mt-0.5 block text-muted-foreground">{hint}</span>
            </span>
          </label>
        ))}
        <Separator />
        <div className="pt-1 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatoMoneda(cart.subtotal)}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>Envío</span>
            <span>{formatoMoneda(costoEnvio)}</span>
          </div>
          <div className="mt-2 flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatoMoneda(total)}</span>
          </div>
        </div>
      </section>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="cart-bar">
        <Button
          type="button"
          size="lg"
          className="w-full shadow-lg"
          disabled={
            loading ||
            !nombre.trim() ||
            !telefono.trim() ||
            (modo === "envio" &&
              (!(menu?.zonas.length ?? 0) || !direccion.trim() || !zonaId)) ||
            bloqueado
          }
          onClick={confirmar}
        >
          {loading ? (
            <>
              <Spinner />
              Enviando…
            </>
          ) : (
            `Confirmar pedido · ${formatoMoneda(total)}`
          )}
        </Button>
      </div>
    </div>
  );
}
