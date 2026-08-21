import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AccountsService } from './accounts.service';

@ApiTags('Cuentas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  private cuentaDe(usuario: JwtPayload): string {
    if (!usuario.cuentaId) {
      throw new BadRequestException('La sesion no tiene una cuenta asociada');
    }
    return usuario.cuentaId;
  }

  @Get()
  @ApiOperation({
    summary: 'Cuentas del usuario autenticado (RF-02 / HU-BE-02 / HU-PW-02)',
  })
  listar(@CurrentUser() usuario: JwtPayload) {
    return this.accountsService.listarPorUsuario(usuario.sub);
  }

  @Get('me')
  @ApiOperation({ summary: 'Resumen de la cuenta autenticada (RF-02 / HU-BE-02)' })
  resumen(@CurrentUser() usuario: JwtPayload) {
    return this.accountsService.resumen(this.cuentaDe(usuario));
  }

  @Get('me/saldo')
  @ApiOperation({ summary: 'Saldo disponible (RF-02 / RF-10 / HU-ATM-02)' })
  saldoPropio(@CurrentUser() usuario: JwtPayload) {
    return this.accountsService.saldo(this.cuentaDe(usuario));
  }

  @Get('me/movimientos')
  @ApiOperation({
    summary: 'Historial de movimientos (RF-03 / HU-BE-03 / HU-ATM-08)',
  })
  movimientosPropios(
    @CurrentUser() usuario: JwtPayload,
    @Query('limite') limite?: string,
  ) {
    const take = Number(limite) > 0 ? Math.min(Number(limite), 100) : 20;
    return this.accountsService.movimientos(this.cuentaDe(usuario), take);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Resumen de una cuenta propia (RF-02 / HU-PW-02)' })
  async resumenPorId(
    @CurrentUser() usuario: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.accountsService.verificarPropiedad(id, usuario.sub, usuario.rol);
    return this.accountsService.resumen(id);
  }

  @Get(':id/saldo')
  @ApiOperation({
    summary: 'Saldo de una cuenta especifica validando propiedad (RNF-03)',
  })
  async saldoPorId(
    @CurrentUser() usuario: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.accountsService.verificarPropiedad(id, usuario.sub, usuario.rol);
    return this.accountsService.saldo(id);
  }

  @Get(':id/movimientos')
  @ApiOperation({ summary: 'Movimientos de una cuenta especifica (RF-03)' })
  async movimientosPorId(
    @CurrentUser() usuario: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('limite') limite?: string,
  ) {
    await this.accountsService.verificarPropiedad(id, usuario.sub, usuario.rol);
    const take = Number(limite) > 0 ? Math.min(Number(limite), 100) : 20;
    return this.accountsService.movimientos(id, take);
  }
}
