import { redirect } from "next/navigation";

/** Inicio → Productos (nav solo 6 módulos). */
export default function PanelHomeRedirect() {
  redirect("/productos");
}
