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
import { ProductImage } from "@/components/product-image";
import {
  crearPedido,
  fetchMenuHoy,
  formatoMoneda,
  hoyISO,
  labelFecha,
} from "@/lib/api";
import { METODO_PAGO } from "@/lib/labels";
import type { MenuHoy } from "@/lib/contract";
import type { MetodoPago, ModoEntrega } from "@tostal/shared/types";

export default function CarritoPage() {
  const cart = useCart();
  const router = useRouter();
  const [menu, setMenu] = useState<MenuHoy | null>(null);
  const [modo, setModo] = useState<ModoEntrega>("retiro");
  const [zonaId, setZonaId] = useState("");
  const [metodoPago, setMetodoPago] = useState<
    Extract<MetodoPago, "transferencia" | "contra_entrega" | "mercadopago">
  >("transferencia");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [direccion, setDireccion] = useState("");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hoy = hoyISO();
    if (cart.fecha !== hoy) cart.setFecha(hoy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    fetchMenuHoy()
      .then((m) => {
        if (!alive) return;
        setMenu(m);
        if (m.zonas[0]) setZonaId(m.zonas[0].id);
        if (cart.fecha !== m.fecha) cart.setFecha(m.fecha);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "Error");
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const costoEnvio = useMemo(() => {
    if (modo !== "envio") return 0;
    return menu?.zonas.find((z) => z.id === zonaId)?.costoEnvio || 0;
  }, [modo, zonaId, menu]);

  const total = cart.subtotal + costoEnvio;
  const bloqueado = menu != null && !menu.aceptaPedidos;

  async function confirmar() {
    const fecha = cart.fecha || hoyISO();
    if (cart.items.length === 0) return;
    if (bloqueado) {
      setError("Ya cerramos pedidos de hoy. Puedes hacer una reserva.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await crearPedido({
        fechaEntrega: fecha,
        modoEntrega: modo,
        zonaId: modo === "envio" ? zonaId : null,
        clienteNombre: nombre.trim(),
        clienteTelefono: telefono.trim(),
        clienteEmail: email.trim() || null,
        direccion: modo === "envio" ? direccion.trim() : null,
        metodoPago,
        notas: notas.trim() || null,
        lineas: cart.items.map((i) => ({
          productoId: i.productoId,
          cantidad: i.cantidad,
        })),
      });
      if (data.checkoutUrl) {
        cart.clear();
        window.location.href = data.checkoutUrl;
        return;
      }
      cart.clear();
      if (data.pagoMock && data.pedido?.codigo) {
        router.push(`/pedido/${data.pedido.codigo}?pago=mock`);
        return;
      }
      if (data.checkoutId) {
        router.push(`/checkout/${data.checkoutId}`);
        return;
      }
      router.push(`/pedido/${data.pedido.codigo}`);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "No se pudo crear el pedido";
      const checkoutId = (e as { checkoutId?: string })?.checkoutId;
      if (checkoutId) {
        router.push(`/checkout/${checkoutId}?pago=error`);
        return;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (cart.items.length === 0) {
    return (
      <div className="page-shell px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Tu carrito</h1>
        <p className="empty-state" role="status">
          Está vacío. Agrega algo del menú de hoy.
        </p>
        <Button asChild>
          <Link href="/">Ver menú</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="page-shell px-6 pb-36 pt-8">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Tu carrito</h1>
        <Link href="/" className="text-sm font-semibold text-miel">
          Seguir pidiendo
        </Link>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Menú de hoy · {labelFecha(cart.fecha || hoyISO())}
      </p>

      {bloqueado && (
        <Alert className="mt-5 border-alerta/40 bg-amber-50 text-alerta">
          <AlertDescription>
            Ya cerramos pedidos de hoy.{" "}
            <Link href="/reservas" className="font-semibold underline">
              Reserva para otra fecha
            </Link>
            .
          </AlertDescription>
        </Alert>
      )}

      <ul className="list-plain mt-8">
        {cart.items.map((item) => (
          <li
            key={item.productoId}
            className="flex items-center justify-between gap-3 py-4"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <ProductImage
                src={item.fotoUrl}
                alt={item.nombre}
                size="sm"
                fallbackLabel={item.nombre}
              />
              <div className="min-w-0">
                <p className="font-semibold tracking-tight">{item.nombre}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {formatoMoneda(item.precio)} c/u
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => cart.setQty(item.productoId, item.cantidad - 1)}
                aria-label="Quitar uno"
              >
                {item.cantidad === 1 ? (
                  <Trash2 size={16} />
                ) : (
                  <Minus size={16} />
                )}
              </Button>
              <span className="w-7 text-center font-semibold tabular-nums">
                {item.cantidad}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => cart.setQty(item.productoId, item.cantidad + 1)}
                aria-label="Agregar uno"
              >
                <Plus size={16} />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <section className="mt-10 space-y-4">
        <h2 className="section-title">Entrega</h2>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={modo === "retiro" ? "default" : "outline"}
            onClick={() => setModo("retiro")}
          >
            Retiro
          </Button>
          <Button
            type="button"
            variant={modo === "envio" ? "default" : "outline"}
            onClick={() => setModo("envio")}
          >
            Envío
          </Button>
        </div>
        {modo === "retiro" && menu?.config.direccionRetiro && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {menu.config.direccionRetiro}
          </p>
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

      <Separator className="my-10" />

      <section className="space-y-4">
        <h2 className="section-title">Tus datos</h2>
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
          <Label htmlFor="email">Email (confirmación del pedido)</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            placeholder="tunombre@correo.com"
          />
          <p className="text-xs text-muted-foreground">
            Guest OK.{" "}
            <Link href="/cuenta" className="font-semibold text-miel">
              Crear cuenta
            </Link>{" "}
            guarda tu historial.
          </p>
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

      <Separator className="my-10" />

      <section className="space-y-3">
        <h2 className="section-title">Pago</h2>
        {(
          [
            [
              "mercadopago",
              "Pagas con tarjeta u otros medios en Mercado Pago",
            ],
            ["transferencia", "Te enviamos los datos; confirmamos a mano"],
            ["contra_entrega", "Pagas al recibir o retirar"],
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
        <div className="pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatoMoneda(cart.subtotal)}</span>
          </div>
          <div className="mt-1.5 flex justify-between">
            <span className="text-muted-foreground">Envío</span>
            <span className="tabular-nums">{formatoMoneda(costoEnvio)}</span>
          </div>
          <div className="mt-3 flex justify-between text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatoMoneda(total)}</span>
          </div>
        </div>
      </section>

      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="cart-bar">
        <Button
          type="button"
          size="lg"
          className="w-full"
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
