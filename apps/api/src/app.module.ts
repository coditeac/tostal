import { Module } from "@nestjs/common";
import {
  HealthController,
  ApiHealthController,
} from "./modules/health/health.controller";
import { AuthController } from "./modules/auth/auth.controller";
import { PublicController } from "./modules/public/public.controller";
import { PublicSseController } from "./modules/public/public-sse.controller";
import { PedidosController } from "./modules/pedidos/pedidos.controller";
import { PedidosSseController } from "./modules/pedidos/pedidos-sse.controller";
import { PagosController } from "./modules/pagos/pagos.controller";
import { ProductosController } from "./modules/productos/productos.controller";
import { InsumosController } from "./modules/productos/insumos.controller";
import { InventarioController } from "./modules/inventario/inventario.controller";
import { AlmacenController } from "./modules/almacen/almacen.controller";
import { CalendarioController } from "./modules/calendario/calendario.controller";
import { ComprasController } from "./modules/compras/compras.controller";
import { GastosController } from "./modules/gastos/gastos.controller";
import {
  FinanzasController,
  IngresosController,
} from "./modules/finanzas/finanzas.controller";
import { ProduccionController } from "./modules/produccion/produccion.controller";
import { AvisosController } from "./modules/avisos/avisos.controller";
import { CajaController } from "./modules/caja/caja.controller";
import { ConfigController } from "./modules/config/config.controller";
import { CostosController } from "./modules/costos/costos.controller";
import { PanelController } from "./modules/panel/panel.controller";
import { ClienteAuthController } from "./modules/cliente/cliente-auth.controller";
import { UsuariosController } from "./modules/usuarios/usuarios.controller";
import { ReservasController } from "./modules/reservas/reservas.controller";
import { MenuDiaController } from "./modules/menu-dia/menu-dia.controller";

@Module({
  imports: [],
  controllers: [
    HealthController,
    ApiHealthController,
    AuthController,
    PublicController,
    PublicSseController,
    PedidosController,
    PedidosSseController,
    PagosController,
    ProductosController,
    InsumosController,
    InventarioController,
    AlmacenController,
    MenuDiaController,
    CalendarioController,
    ComprasController,
    GastosController,
    FinanzasController,
    IngresosController,
    ProduccionController,
    AvisosController,
    CajaController,
    ConfigController,
    CostosController,
    PanelController,
    ClienteAuthController,
    UsuariosController,
    ReservasController,
  ],
  providers: [],
})
export class AppModule {}
