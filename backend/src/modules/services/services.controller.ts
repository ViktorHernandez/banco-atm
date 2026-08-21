import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ServicesService } from './services.service';

@ApiTags('Catalogo de servicios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get('catalogo')
  @ApiOperation({
    summary: 'Catalogo simulado de proveedores de servicio (RF-05 / HU-BE-05)',
  })
  listar() {
    return this.servicesService.listarCatalogo();
  }
}
