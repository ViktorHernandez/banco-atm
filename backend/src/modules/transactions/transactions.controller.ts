import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { DepositoDto } from './dto/deposito.dto';
import { PagoServicioDto } from './dto/pago-servicio.dto';
import { RetiroDto } from './dto/retiro.dto';
import { TransferenciaDto } from './dto/transferencia.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('Transacciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  private contexto(usuario: JwtPayload) {
    if (!usuario.cuentaId) {
      throw new BadRequestException('La sesion no tiene una cuenta asociada');
    }
    return {
      cuentaId: usuario.cuentaId,
      usuarioId: usuario.sub,
      canal: usuario.canal,
    };
  }

  @Get('limites')
  @ApiOperation({
    summary: 'Limites y denominaciones vigentes para las operaciones (RNF-01)',
  })
  limites() {
    return this.transactionsService.obtenerLimites();
  }

  @Post('retiro')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Retiro de efectivo (RF-11 / HU-ATM-03)' })
  retirar(@CurrentUser() usuario: JwtPayload, @Body() dto: RetiroDto) {
    return this.transactionsService.retirar(this.contexto(usuario), dto);
  }

  @Post('deposito')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Depósito de efectivo (RF-12 / HU-ATM-04)' })
  depositar(@CurrentUser() usuario: JwtPayload, @Body() dto: DepositoDto) {
    return this.transactionsService.depositar(this.contexto(usuario), dto);
  }

  @Post('transferencia')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Transferencia entre cuentas del banco (RF-04 / HU-BE-04 / HU-ATM-05)',
  })
  transferir(
    @CurrentUser() usuario: JwtPayload,
    @Body() dto: TransferenciaDto,
  ) {
    return this.transactionsService.transferir(this.contexto(usuario), dto);
  }

  @Post('pago-servicio')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Pago de servicio del catálogo simulado (RF-05 / HU-BE-05 / HU-ATM-09)',
  })
  pagarServicio(
    @CurrentUser() usuario: JwtPayload,
    @Body() dto: PagoServicioDto,
  ) {
    return this.transactionsService.pagarServicio(this.contexto(usuario), dto);
  }

  @Get(':id/comprobante')
  @ApiOperation({ summary: 'Comprobante de una operación (RF-13 / HU-ATM-06)' })
  comprobante(
    @CurrentUser() usuario: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.transactionsService.obtenerComprobante(id, usuario.cuentaId);
  }
}
