/**
 * Cliente staff → Supabase `menu_dia` / `menu_dia_productos`.
 * Re-exporta la capa data (sin Nest).
 */
export {
  getMenuDia,
  saveMenuDia,
  programarMenuDia,
  horaLimiteInputValue,
  type MenuDia,
  type MenuDiaProducto,
} from "@/lib/data/menu-dia";
