// Generated via Supabase MCP generate_typescript_types
// project: yoxsldirdgdpsabsivac · 2026-10-03 (MP columns)
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      compra_items: {
        Row: {
          cantidad: number
          compra_id: string
          costo_unitario: number
          id: string
          insumo_id: string | null
          nombre: string
          subtotal: number
        }
        Insert: {
          cantidad: number
          compra_id: string
          costo_unitario: number
          id?: string
          insumo_id?: string | null
          nombre: string
          subtotal: number
        }
        Update: {
          cantidad?: number
          compra_id?: string
          costo_unitario?: number
          id?: string
          insumo_id?: string | null
          nombre?: string
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "compra_items_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compra_items_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
        ]
      }
      compras: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string | null
          estado: string
          gasto_id: string | null
          id: string
          tienda: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          estado?: string
          gasto_id?: string | null
          id?: string
          tienda: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          estado?: string
          gasto_id?: string | null
          id?: string
          tienda?: string
        }
        Relationships: [
          {
            foreignKeyName: "compras_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_gasto_id_fkey"
            columns: ["gasto_id"]
            isOneToOne: false
            referencedRelation: "gastos"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracion: {
        Row: {
          clave: string
          updated_at: string
          valor: string
        }
        Insert: {
          clave: string
          updated_at?: string
          valor?: string
        }
        Update: {
          clave?: string
          updated_at?: string
          valor?: string
        }
        Relationships: []
      }
      estado_historial: {
        Row: {
          created_at: string
          entidad: string
          entidad_id: string
          estado_anterior: string | null
          estado_nuevo: string
          id: string
          motivo: string | null
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          entidad: string
          entidad_id: string
          estado_anterior?: string | null
          estado_nuevo: string
          id?: string
          motivo?: string | null
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          entidad?: string
          entidad_id?: string
          estado_anterior?: string | null
          estado_nuevo?: string
          id?: string
          motivo?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estado_historial_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          id: string
          pedido_id: string | null
          reserva_id: string | null
          destinatario: string
          evento: string
          asunto: string
          estado: string
          error: string | null
          creado_en: string
        }
        Insert: {
          id?: string
          pedido_id?: string | null
          reserva_id?: string | null
          destinatario: string
          evento: string
          asunto: string
          estado: string
          error?: string | null
          creado_en?: string
        }
        Update: {
          id?: string
          pedido_id?: string | null
          reserva_id?: string | null
          destinatario?: string
          evento?: string
          asunto?: string
          estado?: string
          error?: string | null
          creado_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      gastos: {
        Row: {
          categoria: string | null
          concepto: string
          created_at: string
          created_by: string | null
          id: string
          monto: number
          tienda: string | null
        }
        Insert: {
          categoria?: string | null
          concepto: string
          created_at?: string
          created_by?: string | null
          id?: string
          monto: number
          tienda?: string | null
        }
        Update: {
          categoria?: string | null
          concepto?: string
          created_at?: string
          created_by?: string | null
          id?: string
          monto?: number
          tienda?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gastos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ingresos: {
        Row: {
          concepto: string
          created_at: string
          created_by: string | null
          fuente: string | null
          id: string
          monto: number
        }
        Insert: {
          concepto: string
          created_at?: string
          created_by?: string | null
          fuente?: string | null
          id?: string
          monto: number
        }
        Update: {
          concepto?: string
          created_at?: string
          created_by?: string | null
          fuente?: string | null
          id?: string
          monto?: number
        }
        Relationships: [
          {
            foreignKeyName: "ingresos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      insumos: {
        Row: {
          activo: boolean
          costo_unitario: number
          created_at: string
          id: string
          nombre: string
          stock: number
          umbral_pocos: number
          unidad: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          costo_unitario?: number
          created_at?: string
          id?: string
          nombre: string
          stock?: number
          umbral_pocos?: number
          unidad?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          costo_unitario?: number
          created_at?: string
          id?: string
          nombre?: string
          stock?: number
          umbral_pocos?: number
          unidad?: string
          updated_at?: string
        }
        Relationships: []
      }
      menu_dia: {
        Row: {
          abierto: boolean
          fecha: string
          hora_limite: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          abierto?: boolean
          fecha: string
          hora_limite?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          abierto?: boolean
          fecha?: string
          hora_limite?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      menu_dia_productos: {
        Row: {
          activo: boolean
          fecha: string
          producto_id: string
        }
        Insert: {
          activo?: boolean
          fecha: string
          producto_id: string
        }
        Update: {
          activo?: boolean
          fecha?: string
          producto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_dia_productos_fecha_fkey"
            columns: ["fecha"]
            isOneToOne: false
            referencedRelation: "menu_dia"
            referencedColumns: ["fecha"]
          },
          {
            foreignKeyName: "menu_dia_productos_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_items: {
        Row: {
          cantidad: number
          id: string
          nombre: string
          pedido_id: string
          precio_unitario: number
          producto_id: string | null
          subtotal: number
        }
        Insert: {
          cantidad: number
          id?: string
          nombre: string
          pedido_id: string
          precio_unitario: number
          producto_id?: string | null
          subtotal: number
        }
        Update: {
          cantidad?: number
          id?: string
          nombre?: string
          pedido_id?: string
          precio_unitario?: number
          producto_id?: string | null
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_items_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_items_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      mp_webhook_events: {
        Row: {
          action: string | null
          external_reference: string | null
          payload: Json | null
          payment_id: string
          processed_at: string
          status: string | null
          topic: string | null
        }
        Insert: {
          action?: string | null
          external_reference?: string | null
          payload?: Json | null
          payment_id: string
          processed_at?: string
          status?: string | null
          topic?: string | null
        }
        Update: {
          action?: string | null
          external_reference?: string | null
          payload?: Json | null
          payment_id?: string
          processed_at?: string
          status?: string | null
          topic?: string | null
        }
        Relationships: []
      }
      pedidos: {
        Row: {
          canal: string
          cliente_email: string | null
          cliente_id: string | null
          cliente_nombre: string | null
          cliente_telefono: string | null
          codigo: string
          created_at: string
          costo_envio: number
          direccion: string | null
          estado: string
          estado_pago: string
          fecha_entrega: string
          id: string
          metodo_pago: string | null
          modo_entrega: string
          mp_payment_id: string | null
          mp_preference_id: string | null
          notas: string | null
          subtotal: number
          total: number
          updated_at: string
          zona_id: string | null
        }
        Insert: {
          canal?: string
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_nombre?: string | null
          cliente_telefono?: string | null
          codigo: string
          created_at?: string
          costo_envio?: number
          direccion?: string | null
          estado?: string
          estado_pago?: string
          fecha_entrega: string
          id?: string
          metodo_pago?: string | null
          modo_entrega?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          notas?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
          zona_id?: string | null
        }
        Update: {
          canal?: string
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_nombre?: string | null
          cliente_telefono?: string | null
          codigo?: string
          created_at?: string
          costo_envio?: number
          direccion?: string | null
          estado?: string
          estado_pago?: string
          fecha_entrega?: string
          id?: string
          metodo_pago?: string | null
          modo_entrega?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          notas?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
          zona_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_zona_id_fkey"
            columns: ["zona_id"]
            isOneToOne: false
            referencedRelation: "zonas_envio"
            referencedColumns: ["id"]
          },
        ]
      }
      producto_insumos: {
        Row: {
          cantidad_lote: number
          id: string
          insumo_id: string
          producto_id: string
        }
        Insert: {
          cantidad_lote: number
          id?: string
          insumo_id: string
          producto_id: string
        }
        Update: {
          cantidad_lote?: number
          id?: string
          insumo_id?: string
          producto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "producto_insumos_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_insumos_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          activo: boolean
          anticipo_tipo: string
          anticipo_valor: number
          created_at: string
          descripcion: string | null
          id: string
          imagen_url: string | null
          nombre: string
          precio_venta: number
          receta_rendimiento: number
          reserva_cantidad_minima: number
          reserva_dias_minimos: number
          reserva_habilitada: boolean
          updated_at: string
        }
        Insert: {
          activo?: boolean
          anticipo_tipo?: string
          anticipo_valor?: number
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          nombre: string
          precio_venta?: number
          receta_rendimiento?: number
          reserva_cantidad_minima?: number
          reserva_dias_minimos?: number
          reserva_habilitada?: boolean
          updated_at?: string
        }
        Update: {
          activo?: boolean
          anticipo_tipo?: string
          anticipo_valor?: number
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          nombre?: string
          precio_venta?: number
          receta_rendimiento?: number
          reserva_cantidad_minima?: number
          reserva_dias_minimos?: number
          reserva_habilitada?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activo: boolean
          created_at: string
          email: string
          id: string
          nombre: string | null
          rol: Database["public"]["Enums"]["user_rol"]
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          email: string
          id: string
          nombre?: string | null
          rol?: Database["public"]["Enums"]["user_rol"]
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          email?: string
          id?: string
          nombre?: string | null
          rol?: Database["public"]["Enums"]["user_rol"]
          updated_at?: string
        }
        Relationships: []
      }
      reserva_items: {
        Row: {
          cantidad: number
          id: string
          nombre: string
          precio_unitario: number
          producto_id: string | null
          reserva_id: string
          subtotal: number
        }
        Insert: {
          cantidad: number
          id?: string
          nombre: string
          precio_unitario: number
          producto_id?: string | null
          reserva_id: string
          subtotal: number
        }
        Update: {
          cantidad?: number
          id?: string
          nombre?: string
          precio_unitario?: number
          producto_id?: string | null
          reserva_id?: string
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "reserva_items_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reserva_items_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      reservas: {
        Row: {
          anticipo: number
          cliente_email: string | null
          cliente_id: string | null
          cliente_nombre: string | null
          cliente_telefono: string | null
          codigo: string
          created_at: string
          estado: string
          estado_anticipo: string
          fecha_reserva: string
          id: string
          metodo_pago: string | null
          modo_entrega: string
          notas: string | null
          total: number
          updated_at: string
        }
        Insert: {
          anticipo?: number
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_nombre?: string | null
          cliente_telefono?: string | null
          codigo: string
          created_at?: string
          estado?: string
          estado_anticipo?: string
          fecha_reserva: string
          id?: string
          metodo_pago?: string | null
          modo_entrega?: string
          notas?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          anticipo?: number
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_nombre?: string | null
          cliente_telefono?: string | null
          codigo?: string
          created_at?: string
          estado?: string
          estado_anticipo?: string
          fecha_reserva?: string
          id?: string
          metodo_pago?: string | null
          modo_entrega?: string
          notas?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      zonas_envio: {
        Row: {
          activa: boolean
          cobertura: string | null
          costo_envio: number
          created_at: string
          id: string
          nombre: string
          orden: number
          updated_at: string
        }
        Insert: {
          activa?: boolean
          cobertura?: string | null
          costo_envio?: number
          created_at?: string
          id?: string
          nombre: string
          orden?: number
          updated_at?: string
        }
        Update: {
          activa?: boolean
          cobertura?: string | null
          costo_envio?: number
          created_at?: string
          id?: string
          nombre?: string
          orden?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calcular_costo_envio: { Args: { p_zona_id: string }; Returns: Json }
      current_rol: {
        Args: never
        Returns: Database["public"]["Enums"]["user_rol"]
      }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      get_menu_hoy: { Args: never; Returns: Json }
      get_pedido_publico: { Args: { p_codigo: string }; Returns: Json }
      get_reserva_publica: { Args: { p_codigo: string }; Returns: Json }
      crear_pedido_publico: { Args: { p_body: Json }; Returns: Json }
      crear_reserva_publica: { Args: { p_body: Json }; Returns: Json }
      list_reservas_productos: { Args: never; Returns: Json }
      list_zonas_activas: { Args: never; Returns: Json }
      hoy_cdmx: { Args: never; Returns: string }
      gen_pedido_codigo: { Args: never; Returns: string }
      gen_reserva_codigo: { Args: never; Returns: string }
    }
    Enums: {
      user_rol: "superadmin" | "admin" | "cocina" | "caja" | "cliente"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      user_rol: ["superadmin", "admin", "cocina", "caja", "cliente"],
    },
  },
} as const
