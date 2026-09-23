"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { apiGet, apiPost, formatoMoneda, labelFecha } from "@/lib/api";

type Zona = {
  id: string;
  nombre: string;
  cobertura: string | null;
  costoEnvio: number;
  activa: boolean;
};

type MenuResponse = {
  abierto: boolean;
  deadlineVigente: boolean;
  zonas: Zona[];
  config: { moneda: string; direccionRetiro?: string | null };
};

export default function CarritoPage() {
  const cart = useCart();
  const router = useRouter();
  const [menu, setMenu] = useState<MenuResponse | null>(null);
  const [modo, setModo] = useState<"retiro" | "envio">("retiro");
  const [zonaId, setZonaId] = useState("");
  const [metodoPago, setMetodoPago] = useState<
    "transferencia" | "contra_entrega" | "stripe"
  >("transferencia");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!cart.fecha) return;
    apiGet<MenuResponse>(`/api/public/menu?fecha=${cart.fecha}`)
      .then((m) => {
        setMenu(m);
        if (m.zonas[0]) setZonaId(m.zonas[0].id);
      })
      .catch((e) => setError(e.message));
  }, [cart.fecha]);

  const costoEnvio = useMemo(() => {
    if (modo !== "envio") return 0;
    return menu?.zonas.find((z) => z.id === zonaId)?.costoEnvio || 0;
  }, [modo, zonaId, menu]);

  const total = cart.subtotal + costoEnvio;

  async function confirmar() {
    if (!cart.fecha || cart.items.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiPost<{ pedido: { codigo: string } }>(
        "/api/public/pedidos",
        {
          fechaEntrega: cart.fecha,
          modoEntrega: modo,
          zonaId: modo === "envio" ? zonaId : null,
          clienteNombre: nombre,
          clienteTelefono: telefono,
          direccion: modo === "envio" ? direccion : null,
          metodoPago,
          notas: notas || null,
          lineas: cart.items.map((i) => ({
            productoId: i.productoId,
            cantidad: i.cantidad,
          })),
        }
      );
      cart.clear();
      router.push(`/pedido/${data.pedido.codigo}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el pedido");
    } finally {
      setLoading(false);
    }
  }

  if (!cart.fecha) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <p className="text-muted">Elige primero una fecha en el menú.</p>
        <Link href="/" className="btn btn-primary mt-4 inline-flex">
          Ir al menú
        </Link>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1 className="font-display text-3xl">Tu carrito</h1>
        <p className="mt-2 text-muted">Está vacío. Agrega algo del menú.</p>
        <Link href="/" className="btn btn-primary mt-4 inline-flex">
          Ver menú
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg px-4 pb-28 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Tu carrito</h1>
        <Link href="/" className="text-sm font-semibold text-miel-dark">
          Seguir pidiendo
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted">
        Entrega/retiro: {labelFecha(cart.fecha)}
      </p>

      <ul className="mt-4 space-y-3">
        {cart.items.map((item) => (
          <li
            key={item.productoId}
            className="surface flex items-center justify-between gap-3 p-3"
          >
            <div>
              <p className="font-semibold">{item.nombre}</p>
              <p className="text-sm text-muted">
                {formatoMoneda(item.precio)} c/u
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-full border border-border p-1.5"
                onClick={() =>
                  cart.setQty(item.productoId, item.cantidad - 1)
                }
                aria-label="Quitar uno"
              >
                {item.cantidad === 1 ? (
                  <Trash2 size={16} />
                ) : (
                  <Minus size={16} />
                )}
              </button>
              <span className="w-6 text-center font-semibold">
                {item.cantidad}
              </span>
              <button
                type="button"
                className="rounded-full border border-border p-1.5"
                onClick={() =>
                  cart.setQty(item.productoId, item.cantidad + 1)
                }
                aria-label="Agregar uno"
              >
                <Plus size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <section className="surface mt-4 space-y-3 p-4">
        <h2 className="font-semibold">Entrega</h2>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className={`rounded-2xl px-3 py-3 text-sm font-semibold ${
              modo === "retiro" ? "bg-cacao text-crema" : "bg-white border border-border"
            }`}
            onClick={() => setModo("retiro")}
          >
            Retiro
          </button>
          <button
            type="button"
            className={`rounded-2xl px-3 py-3 text-sm font-semibold ${
              modo === "envio" ? "bg-cacao text-crema" : "bg-white border border-border"
            }`}
            onClick={() => setModo("envio")}
          >
            Envío
          </button>
        </div>
        {modo === "retiro" && menu?.config.direccionRetiro && (
          <p className="text-sm text-muted">{menu.config.direccionRetiro}</p>
        )}
        {modo === "envio" && (
          <>
            <div>
              <label className="label">Zona</label>
              <select
                className="field"
                value={zonaId}
                onChange={(e) => setZonaId(e.target.value)}
              >
                {(menu?.zonas || []).map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.nombre} · {formatoMoneda(z.costoEnvio)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Dirección</label>
              <input
                className="field"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Calle, número, colonia…"
              />
            </div>
          </>
        )}
      </section>

      <section className="surface mt-4 space-y-3 p-4">
        <h2 className="font-semibold">Tus datos</h2>
        <div>
          <label className="label">Nombre</label>
          <input
            className="field"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">WhatsApp / teléfono</label>
          <input
            className="field"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Notas (opcional)</label>
          <textarea
            className="field min-h-16"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
        </div>
      </section>

      <section className="surface mt-4 space-y-3 p-4">
        <h2 className="font-semibold">Pago</h2>
        {(
          [
            ["transferencia", "Transferencia (confirmamos a mano)"],
            ["contra_entrega", "Pago contra entrega / retiro"],
            ["stripe", "Tarjeta en línea (Stripe · mock si no hay clave)"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="pago"
              checked={metodoPago === value}
              onChange={() => setMetodoPago(value)}
            />
            {label}
          </label>
        ))}
        <div className="border-t border-border pt-3 text-sm">
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
        <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-error">
          {error}
        </p>
      )}

      <div className="cart-bar">
        <button
          type="button"
          className="btn btn-primary w-full shadow-lg"
          disabled={
            loading ||
            !nombre.trim() ||
            !telefono.trim() ||
            (modo === "envio" && !direccion.trim()) ||
            menu?.abierto === false ||
            menu?.deadlineVigente === false
          }
          onClick={confirmar}
        >
          {loading
            ? "Enviando…"
            : `Confirmar pedido · ${formatoMoneda(total)}`}
        </button>
      </div>
    </div>
  );
}
