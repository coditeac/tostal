"use client";

import { useEffect, useState } from "react";
import { Copy, ExternalLink } from "lucide-react";

type Aviso = {
  id: string;
  pedidoId: string | null;
  destinatario: string;
  telefono: string;
  evento: string;
  texto: string;
  estado: string;
  creadoEn: string;
};

export default function WhatsappPage() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("pendiente");
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/whatsapp?estado=${filtro}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setAvisos(data.avisos || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [filtro]);

  async function marcar(id: string, estado: string) {
    await fetch("/api/whatsapp", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, estado }),
    });
    await load();
  }

  function copiar(texto: string, id: string) {
    navigator.clipboard.writeText(texto);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  function waLink(telefono: string, texto: string) {
    const digits = telefono.replace(/\D/g, "");
    return `https://wa.me/${digits}?text=${encodeURIComponent(texto)}`;
  }

  return (
    <div className="space-y-4 rise-in">
      <div>
        <h1 className="font-display text-3xl">Avisos WhatsApp</h1>
        <p className="text-sm text-muted">
          Cola manual: copia o abre WhatsApp. La app no envía sola.
        </p>
      </div>

      <div className="flex gap-2">
        {["pendiente", "enviado", "omitido", "todos"].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltro(f)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              filtro === f ? "bg-cacao text-crema" : "surface"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}

      {loading ? (
        <p className="loading-pulse text-muted">Cargando avisos…</p>
      ) : avisos.length === 0 ? (
        <p className="surface p-4 text-sm text-muted">
          No hay avisos en este filtro.
        </p>
      ) : (
        <ul className="space-y-3">
          {avisos.map((a) => (
            <li key={a.id} className="surface space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{a.destinatario}</p>
                  <p className="text-sm text-muted">
                    {a.telefono} · {a.evento}
                  </p>
                </div>
                <span className="rounded-full bg-arena px-2 py-0.5 text-xs">
                  {a.estado}
                </span>
              </div>
              <p className="rounded-xl bg-white/80 p-3 text-sm">{a.texto}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-secondary py-2 text-sm"
                  onClick={() => copiar(a.texto, a.id)}
                >
                  <Copy size={16} />
                  {copied === a.id ? "Copiado" : "Copiar"}
                </button>
                <a
                  className="btn btn-primary py-2 text-sm"
                  href={waLink(a.telefono, a.texto)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={16} />
                  Abrir WhatsApp
                </a>
                {a.estado === "pendiente" && (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary py-2 text-sm"
                      onClick={() => marcar(a.id, "enviado")}
                    >
                      Marcado enviado
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost py-2 text-sm"
                      onClick={() => marcar(a.id, "omitido")}
                    >
                      Omitir
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
