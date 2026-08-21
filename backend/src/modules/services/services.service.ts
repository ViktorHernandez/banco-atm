import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CATALOGO_PROVEEDORES,
  ProveedorServicio,
} from './data/catalogo-proveedores';

@Injectable()
export class ServicesService {
  listarCatalogo(): ProveedorServicio[] {
    return CATALOGO_PROVEEDORES;
  }

  obtenerProveedor(codigo: string): ProveedorServicio {
    const proveedor = CATALOGO_PROVEEDORES.find(
      (item) => item.codigo === codigo.toUpperCase(),
    );

    if (!proveedor) {
      throw new NotFoundException(
        'El proveedor de servicio no existe en el catalogo',
      );
    }

    return proveedor;
  }
}
