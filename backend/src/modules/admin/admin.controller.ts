import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CardsService } from '../cards/cards.service';
import { ActualizarEstadoTarjetaDto } from '../cards/dto/actualizar-estado-tarjeta.dto';
import { RolUsuario } from '../users/enums/rol-usuario.enum';
import { AdminService } from './admin.service';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';

@ApiTags('Administracion')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMINISTRADOR)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly cardsService: CardsService,
  ) {}

  @Get('usuarios')
  @ApiOperation({ summary: 'Listado de usuarios registrados (RF-16 / HU-PW-06)' })
  listarUsuarios() {
    return this.adminService.listarUsuarios();
  }

  @Get('usuarios/:id')
  @ApiOperation({ summary: 'Detalle de un usuario (RF-16)' })
  obtenerUsuario(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminService.obtenerUsuario(id);
  }

  @Post('usuarios')
  @ApiOperation({
    summary: 'Alta de cliente con cuenta y tarjeta (RF-16 / HU-PW-06)',
  })
  crearCliente(
    @CurrentUser() administrador: JwtPayload,
    @Body() dto: CrearUsuarioDto,
  ) {
    return this.adminService.crearCliente(dto, administrador.sub);
  }

  @Patch('usuarios/:id')
  @ApiOperation({ summary: 'Actualizacion de datos de un usuario (RF-16)' })
  actualizarUsuario(
    @CurrentUser() administrador: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ActualizarUsuarioDto,
  ) {
    return this.adminService.actualizarUsuario(id, dto, administrador.sub);
  }

  @Get('tarjetas')
  @ApiOperation({ summary: 'Listado de tarjetas del banco (RF-18 / HU-PW-08)' })
  listarTarjetas() {
    return this.cardsService.listarTodas();
  }

  @Patch('tarjetas/:id/estado')
  @ApiOperation({ summary: 'Actualizacion del estado de una tarjeta (RF-18)' })
  actualizarEstadoTarjeta(
    @CurrentUser() administrador: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ActualizarEstadoTarjetaDto,
  ) {
    return this.cardsService.actualizarEstadoComoAdministrador(
      id,
      dto.estado,
      administrador.sub,
    );
  }

  @Get('reportes/operaciones')
  @ApiOperation({ summary: 'Reporte basico de operaciones (RF-17 / HU-PW-07)' })
  reporteOperaciones() {
    return this.adminService.reporteOperaciones();
  }

  @Get('auditoria')
  @ApiOperation({ summary: 'Consulta de registros de auditoria (RF-19 / HU-BE-08)' })
  auditoria(@Query('limite') limite?: string) {
    const take = Number(limite) > 0 ? Math.min(Number(limite), 500) : 100;
    return this.adminService.listarAuditoria(take);
  }
}
