# Migración: checkout pendiente + estados de verificación

Aplicar vía Supabase MCP en `yoxsldirdgdpsabsivac` (nombre: `checkout_pendiente_pago_antes`).

## Objetivo

- Mercado Pago no crea pedido/reserva hasta `approved`.
- Transferencia → `pendiente_verificacion` (pedido) / anticipo `pendiente_verificacion` (reserva).
- Reservas: solo `transferencia` | `mercadopago`.

```sql
-- 1) Tabla de checkouts pendientes (carrito/reserva antes de materializar)
CREATE TABLE IF NOT EXISTS public.checkout_pendiente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('pedido', 'reserva')),
  payload jsonb NOT NULL,
  monto_centavos numeric NOT NULL CHECK (monto_centavos >= 0),
  moneda text NOT NULL DEFAULT 'MXN',
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'expirado', 'convertido')),
  mp_preference_id text,
  mp_payment_id text,
  entidad_id uuid,
  codigo text,
  cliente_email text,
  error_msg text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 hours')
);

CREATE INDEX IF NOT EXISTS checkout_pendiente_estado_idx
  ON public.checkout_pendiente (estado, created_at DESC);
CREATE INDEX IF NOT EXISTS checkout_pendiente_mp_pref_idx
  ON public.checkout_pendiente (mp_preference_id);

ALTER TABLE public.checkout_pendiente ENABLE ROW LEVEL SECURITY;
-- Sin policies anon/authenticated: solo service_role.

-- 2) Pedido: transferencia → pendiente_verificacion
CREATE OR REPLACE FUNCTION public.crear_pedido_publico(p_body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fecha date := public.hoy_cdmx();
  v_md public.menu_dia%ROWTYPE;
  v_deadline timestamptz;
  v_uid uuid := auth.uid();
  v_lineas jsonb := coalesce(p_body->'lineas', '[]'::jsonb);
  v_linea jsonb;
  v_prod public.productos%ROWTYPE;
  v_subtotal numeric := 0;
  v_costo_envio numeric := 0;
  v_total numeric;
  v_pedido_id uuid;
  v_codigo text;
  v_qty numeric;
  v_line_sub numeric;
  v_modo text := coalesce(nullif(p_body->>'modoEntrega', ''), 'retiro');
  v_zona_id uuid := null;
  v_zona public.zonas_envio%ROWTYPE;
  v_direccion text := nullif(trim(coalesce(p_body->>'direccion', '')), '');
  v_metodo text := coalesce(nullif(p_body->>'metodoPago', ''), 'transferencia');
  v_estado_pago text;
BEGIN
  SELECT * INTO v_md FROM public.menu_dia WHERE fecha = v_fecha;
  IF NOT FOUND OR NOT v_md.abierto THEN
    RAISE EXCEPTION 'Hoy el menú no acepta pedidos.' USING ERRCODE = 'P0001';
  END IF;
  v_deadline := public.deadline_cdmx(v_fecha, v_md.hora_limite);
  IF v_deadline IS NOT NULL AND now() >= v_deadline THEN
    RAISE EXCEPTION 'Ya cerramos pedidos para hoy (hora límite CDMX).' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_array_length(v_lineas) < 1 THEN
    RAISE EXCEPTION 'Agrega al menos un producto.' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(trim(p_body->>'clienteNombre'), '') = '' OR coalesce(trim(p_body->>'clienteTelefono'), '') = '' THEN
    RAISE EXCEPTION 'Nombre y teléfono son obligatorios.' USING ERRCODE = 'P0001';
  END IF;

  IF v_modo NOT IN ('retiro', 'envio') THEN
    RAISE EXCEPTION 'Modo de entrega inválido.' USING ERRCODE = 'P0001';
  END IF;

  IF v_metodo NOT IN ('transferencia', 'contra_entrega', 'mercadopago', 'stripe', 'efectivo_mostrador') THEN
    RAISE EXCEPTION 'Método de pago inválido.' USING ERRCODE = 'P0001';
  END IF;

  IF v_modo = 'envio' THEN
    BEGIN
      v_zona_id := nullif(trim(coalesce(p_body->>'zonaId', '')), '')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Elige una zona de envío válida.' USING ERRCODE = 'P0001';
    END;
    IF v_zona_id IS NULL THEN
      RAISE EXCEPTION 'Elige una zona de envío.' USING ERRCODE = 'P0001';
    END IF;
    IF v_direccion IS NULL THEN
      RAISE EXCEPTION 'La dirección es obligatoria para envío.' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO v_zona FROM public.zonas_envio WHERE id = v_zona_id AND activa = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Tu zona no está cubierta. Puedes retirar en tienda.' USING ERRCODE = 'P0001';
    END IF;
    v_costo_envio := round(v_zona.costo_envio);
  ELSE
    v_zona_id := NULL;
    v_costo_envio := 0;
    v_direccion := NULL;
  END IF;

  FOR v_linea IN SELECT * FROM jsonb_array_elements(v_lineas)
  LOOP
    SELECT p.* INTO v_prod
    FROM public.productos p
    JOIN public.menu_dia_productos mdp ON mdp.producto_id = p.id
    WHERE p.id = (v_linea->>'productoId')::uuid
      AND mdp.fecha = v_fecha AND mdp.activo AND p.activo;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Un producto ya no está en el menú de hoy.' USING ERRCODE = 'P0001';
    END IF;
    v_qty := greatest(1, least(99, coalesce((v_linea->>'cantidad')::numeric, 1)));
    v_subtotal := v_subtotal + (round(v_prod.precio_venta) * v_qty);
  END LOOP;

  v_total := v_subtotal + v_costo_envio;
  v_codigo := public.gen_pedido_codigo();

  v_estado_pago := CASE
    WHEN v_metodo = 'contra_entrega' THEN 'contra_entrega'
    WHEN v_metodo = 'transferencia' THEN 'pendiente_verificacion'
    WHEN v_metodo IN ('mercadopago', 'stripe') THEN 'pendiente'
    ELSE 'pendiente'
  END;

  INSERT INTO public.pedidos (
    codigo, cliente_id, cliente_email, cliente_nombre, cliente_telefono,
    fecha_entrega, canal, estado, metodo_pago, modo_entrega, direccion,
    zona_id, subtotal, costo_envio, total, estado_pago, notas
  ) VALUES (
    v_codigo, v_uid,
    nullif(trim(coalesce(p_body->>'clienteEmail', p_body->>'email', '')), ''),
    trim(p_body->>'clienteNombre'),
    trim(p_body->>'clienteTelefono'),
    v_fecha, 'remoto', 'recibido',
    v_metodo,
    v_modo,
    v_direccion,
    v_zona_id,
    v_subtotal, v_costo_envio, v_total,
    v_estado_pago,
    nullif(trim(coalesce(p_body->>'notas', '')), '')
  ) RETURNING id INTO v_pedido_id;

  FOR v_linea IN SELECT * FROM jsonb_array_elements(v_lineas)
  LOOP
    SELECT p.* INTO v_prod FROM public.productos p WHERE p.id = (v_linea->>'productoId')::uuid;
    v_qty := greatest(1, least(99, coalesce((v_linea->>'cantidad')::numeric, 1)));
    v_line_sub := round(v_prod.precio_venta) * v_qty;
    INSERT INTO public.pedido_items (pedido_id, producto_id, nombre, cantidad, precio_unitario, subtotal)
    VALUES (v_pedido_id, v_prod.id, v_prod.nombre, v_qty, round(v_prod.precio_venta), v_line_sub);
  END LOOP;

  INSERT INTO public.estado_historial (entidad, entidad_id, estado_anterior, estado_nuevo, usuario_id)
  VALUES ('pedido', v_pedido_id, null, 'recibido', v_uid);

  RETURN public.get_pedido_publico(v_codigo);
END;
$function$;

-- 3) Cotizar pedido (sin insertar) — para preferencia MP
CREATE OR REPLACE FUNCTION public.cotizar_pedido_publico(p_body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fecha date := public.hoy_cdmx();
  v_md public.menu_dia%ROWTYPE;
  v_deadline timestamptz;
  v_lineas jsonb := coalesce(p_body->'lineas', '[]'::jsonb);
  v_linea jsonb;
  v_prod public.productos%ROWTYPE;
  v_subtotal numeric := 0;
  v_costo_envio numeric := 0;
  v_modo text := coalesce(nullif(p_body->>'modoEntrega', ''), 'retiro');
  v_zona_id uuid := null;
  v_zona public.zonas_envio%ROWTYPE;
  v_direccion text := nullif(trim(coalesce(p_body->>'direccion', '')), '');
  v_qty numeric;
BEGIN
  SELECT * INTO v_md FROM public.menu_dia WHERE fecha = v_fecha;
  IF NOT FOUND OR NOT v_md.abierto THEN
    RAISE EXCEPTION 'Hoy el menú no acepta pedidos.' USING ERRCODE = 'P0001';
  END IF;
  v_deadline := public.deadline_cdmx(v_fecha, v_md.hora_limite);
  IF v_deadline IS NOT NULL AND now() >= v_deadline THEN
    RAISE EXCEPTION 'Ya cerramos pedidos para hoy (hora límite CDMX).' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_array_length(v_lineas) < 1 THEN
    RAISE EXCEPTION 'Agrega al menos un producto.' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(trim(p_body->>'clienteNombre'), '') = '' OR coalesce(trim(p_body->>'clienteTelefono'), '') = '' THEN
    RAISE EXCEPTION 'Nombre y teléfono son obligatorios.' USING ERRCODE = 'P0001';
  END IF;
  IF v_modo NOT IN ('retiro', 'envio') THEN
    RAISE EXCEPTION 'Modo de entrega inválido.' USING ERRCODE = 'P0001';
  END IF;

  IF v_modo = 'envio' THEN
    BEGIN
      v_zona_id := nullif(trim(coalesce(p_body->>'zonaId', '')), '')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Elige una zona de envío válida.' USING ERRCODE = 'P0001';
    END;
    IF v_zona_id IS NULL THEN
      RAISE EXCEPTION 'Elige una zona de envío.' USING ERRCODE = 'P0001';
    END IF;
    IF v_direccion IS NULL THEN
      RAISE EXCEPTION 'La dirección es obligatoria para envío.' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO v_zona FROM public.zonas_envio WHERE id = v_zona_id AND activa = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Tu zona no está cubierta. Puedes retirar en tienda.' USING ERRCODE = 'P0001';
    END IF;
    v_costo_envio := round(v_zona.costo_envio);
  END IF;

  FOR v_linea IN SELECT * FROM jsonb_array_elements(v_lineas)
  LOOP
    SELECT p.* INTO v_prod
    FROM public.productos p
    JOIN public.menu_dia_productos mdp ON mdp.producto_id = p.id
    WHERE p.id = (v_linea->>'productoId')::uuid
      AND mdp.fecha = v_fecha AND mdp.activo AND p.activo;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Un producto ya no está en el menú de hoy.' USING ERRCODE = 'P0001';
    END IF;
    v_qty := greatest(1, least(99, coalesce((v_linea->>'cantidad')::numeric, 1)));
    v_subtotal := v_subtotal + (round(v_prod.precio_venta) * v_qty);
  END LOOP;

  RETURN jsonb_build_object(
    'subtotal', round(v_subtotal)::bigint,
    'costoEnvio', round(v_costo_envio)::bigint,
    'total', round(v_subtotal + v_costo_envio)::bigint,
    'fechaEntrega', v_fecha
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cotizar_pedido_publico(jsonb) TO anon, authenticated, service_role;

-- 4) Reserva: solo transferencia|mercadopago; transferencia → pendiente_verificacion
CREATE OR REPLACE FUNCTION public.crear_reserva_publica(p_body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fecha date := coalesce((p_body->>'fecha')::date, (p_body->>'fechaEntrega')::date);
  v_hoy date := public.hoy_cdmx();
  v_uid uuid := auth.uid();
  v_lineas jsonb := coalesce(p_body->'lineas', '[]'::jsonb);
  v_linea jsonb;
  v_prod public.productos%ROWTYPE;
  v_subtotal numeric := 0;
  v_anticipo numeric := 0;
  v_qty numeric;
  v_line_sub numeric;
  v_min_fecha date;
  v_reserva_id uuid;
  v_codigo text;
  v_max_dias int := 0;
  v_anticipo_tipo text;
  v_anticipo_valor numeric;
  v_metodo text := coalesce(nullif(p_body->>'metodoPago', ''), 'transferencia');
  v_estado_anticipo text;
BEGIN
  IF v_fecha IS NULL THEN
    RAISE EXCEPTION 'Indica la fecha de la reserva.' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_array_length(v_lineas) < 1 THEN
    RAISE EXCEPTION 'Agrega al menos un producto.' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(trim(p_body->>'clienteNombre'), '') = '' OR coalesce(trim(p_body->>'clienteTelefono'), '') = '' THEN
    RAISE EXCEPTION 'Nombre y teléfono son obligatorios.' USING ERRCODE = 'P0001';
  END IF;

  IF v_metodo NOT IN ('transferencia', 'mercadopago', 'stripe') THEN
    RAISE EXCEPTION 'Las reservas solo admiten transferencia o Mercado Pago.' USING ERRCODE = 'P0001';
  END IF;

  FOR v_linea IN SELECT * FROM jsonb_array_elements(v_lineas)
  LOOP
    SELECT * INTO v_prod FROM public.productos
    WHERE id = (v_linea->>'productoId')::uuid AND activo AND reserva_habilitada;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ese producto no admite reserva.' USING ERRCODE = 'P0001';
    END IF;
    v_qty := greatest(1, least(999, coalesce((v_linea->>'cantidad')::numeric, 1)));
    IF v_qty < v_prod.reserva_cantidad_minima THEN
      RAISE EXCEPTION 'La cantidad mínima para % es %.', v_prod.nombre, v_prod.reserva_cantidad_minima USING ERRCODE = 'P0001';
    END IF;
    v_max_dias := greatest(v_max_dias, v_prod.reserva_dias_minimos);
    v_line_sub := round(v_prod.precio_venta) * v_qty;
    v_subtotal := v_subtotal + v_line_sub;
    v_anticipo_tipo := v_prod.anticipo_tipo;
    v_anticipo_valor := v_prod.anticipo_valor;
  END LOOP;

  v_min_fecha := v_hoy + v_max_dias;
  IF v_fecha < v_min_fecha THEN
    RAISE EXCEPTION 'La reserva requiere al menos % días de anticipación. La fecha mínima es %.', v_max_dias, v_min_fecha USING ERRCODE = 'P0001';
  END IF;

  IF v_anticipo_tipo IN ('monto', 'fixed') THEN
    v_anticipo := least(round(coalesce(v_anticipo_valor, 0)), v_subtotal);
  ELSE
    v_anticipo := round(v_subtotal * coalesce(v_anticipo_valor, 0) / 100);
  END IF;
  v_anticipo := greatest(0, v_anticipo);

  v_estado_anticipo := CASE
    WHEN v_metodo = 'transferencia' THEN 'pendiente_verificacion'
    ELSE 'pendiente'
  END;

  v_codigo := public.gen_reserva_codigo();
  INSERT INTO public.reservas (
    codigo, cliente_id, cliente_email, cliente_nombre, cliente_telefono,
    fecha_reserva, estado, anticipo, total, metodo_pago, modo_entrega, notas, estado_anticipo
  ) VALUES (
    v_codigo, v_uid,
    nullif(trim(coalesce(p_body->>'clienteEmail', p_body->>'email', '')), ''),
    trim(p_body->>'clienteNombre'),
    trim(p_body->>'clienteTelefono'),
    v_fecha, 'recibido', v_anticipo, v_subtotal,
    v_metodo,
    coalesce(nullif(p_body->>'modoEntrega', ''), 'retiro'),
    nullif(trim(coalesce(p_body->>'notas', '')), ''),
    v_estado_anticipo
  ) RETURNING id INTO v_reserva_id;

  FOR v_linea IN SELECT * FROM jsonb_array_elements(v_lineas)
  LOOP
    SELECT * INTO v_prod FROM public.productos WHERE id = (v_linea->>'productoId')::uuid;
    v_qty := greatest(1, least(999, coalesce((v_linea->>'cantidad')::numeric, 1)));
    v_line_sub := round(v_prod.precio_venta) * v_qty;
    INSERT INTO public.reserva_items (reserva_id, producto_id, nombre, cantidad, precio_unitario, subtotal)
    VALUES (v_reserva_id, v_prod.id, v_prod.nombre, v_qty, round(v_prod.precio_venta), v_line_sub);
  END LOOP;

  INSERT INTO public.estado_historial (entidad, entidad_id, estado_anterior, estado_nuevo, usuario_id)
  VALUES ('reserva', v_reserva_id, null, 'recibido', v_uid);

  RETURN jsonb_build_object(
    'reserva', jsonb_build_object(
      'id', v_reserva_id,
      'codigo', v_codigo,
      'fechaEntrega', v_fecha,
      'total', round(v_subtotal)::bigint,
      'anticipoMonto', round(v_anticipo)::bigint,
      'estado', 'recibido',
      'estadoAnticipo', v_estado_anticipo,
      'checkoutUrl', null
    )
  );
END;
$function$;

-- 5) Cotizar reserva (anticipo) sin insertar
CREATE OR REPLACE FUNCTION public.cotizar_reserva_publica(p_body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fecha date := coalesce((p_body->>'fecha')::date, (p_body->>'fechaEntrega')::date);
  v_hoy date := public.hoy_cdmx();
  v_lineas jsonb := coalesce(p_body->'lineas', '[]'::jsonb);
  v_linea jsonb;
  v_prod public.productos%ROWTYPE;
  v_subtotal numeric := 0;
  v_anticipo numeric := 0;
  v_qty numeric;
  v_min_fecha date;
  v_max_dias int := 0;
  v_anticipo_tipo text;
  v_anticipo_valor numeric;
  v_metodo text := coalesce(nullif(p_body->>'metodoPago', ''), 'mercadopago');
BEGIN
  IF v_fecha IS NULL THEN
    RAISE EXCEPTION 'Indica la fecha de la reserva.' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_array_length(v_lineas) < 1 THEN
    RAISE EXCEPTION 'Agrega al menos un producto.' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(trim(p_body->>'clienteNombre'), '') = '' OR coalesce(trim(p_body->>'clienteTelefono'), '') = '' THEN
    RAISE EXCEPTION 'Nombre y teléfono son obligatorios.' USING ERRCODE = 'P0001';
  END IF;
  IF v_metodo NOT IN ('transferencia', 'mercadopago', 'stripe') THEN
    RAISE EXCEPTION 'Las reservas solo admiten transferencia o Mercado Pago.' USING ERRCODE = 'P0001';
  END IF;

  FOR v_linea IN SELECT * FROM jsonb_array_elements(v_lineas)
  LOOP
    SELECT * INTO v_prod FROM public.productos
    WHERE id = (v_linea->>'productoId')::uuid AND activo AND reserva_habilitada;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ese producto no admite reserva.' USING ERRCODE = 'P0001';
    END IF;
    v_qty := greatest(1, least(999, coalesce((v_linea->>'cantidad')::numeric, 1)));
    IF v_qty < v_prod.reserva_cantidad_minima THEN
      RAISE EXCEPTION 'La cantidad mínima para % es %.', v_prod.nombre, v_prod.reserva_cantidad_minima USING ERRCODE = 'P0001';
    END IF;
    v_max_dias := greatest(v_max_dias, v_prod.reserva_dias_minimos);
    v_subtotal := v_subtotal + (round(v_prod.precio_venta) * v_qty);
    v_anticipo_tipo := v_prod.anticipo_tipo;
    v_anticipo_valor := v_prod.anticipo_valor;
  END LOOP;

  v_min_fecha := v_hoy + v_max_dias;
  IF v_fecha < v_min_fecha THEN
    RAISE EXCEPTION 'La reserva requiere al menos % días de anticipación. La fecha mínima es %.', v_max_dias, v_min_fecha USING ERRCODE = 'P0001';
  END IF;

  IF v_anticipo_tipo IN ('monto', 'fixed') THEN
    v_anticipo := least(round(coalesce(v_anticipo_valor, 0)), v_subtotal);
  ELSE
    v_anticipo := round(v_subtotal * coalesce(v_anticipo_valor, 0) / 100);
  END IF;
  v_anticipo := greatest(0, v_anticipo);

  RETURN jsonb_build_object(
    'subtotal', round(v_subtotal)::bigint,
    'anticipoMonto', round(v_anticipo)::bigint,
    'total', round(v_subtotal)::bigint,
    'fechaEntrega', v_fecha
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cotizar_reserva_publica(jsonb) TO anon, authenticated, service_role;
```
