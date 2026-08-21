import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CardsService } from './cards.service';
import { CambiarPinDto } from './dto/cambiar-pin.dto';

@ApiTags('Tarjetas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cards')
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  private cuentaDe(usuario: JwtPayload): string {
    if (!usuario.cuentaId) {
      throw new BadRequestException('La sesion no tiene una cuenta asociada');
    }
    return usuario.cuentaId;
  }

  @Get('me')
  @ApiOperation({ summary: 'Estado de la tarjeta del cliente (HU-BE-06)' })
  consultar(@CurrentUser() usuario: JwtPayload) {
    return this.cardsService.consultarPropia(this.cuentaDe(usuario));
  }

  @Post('me/bloquear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bloqueo de tarjeta por el cliente (RF-06)' })
  bloquear(@CurrentUser() usuario: JwtPayload) {
    return this.cardsService.bloquearPropia(
      this.cuentaDe(usuario),
      usuario.sub,
      usuario.canal,
    );
  }

  @Post('me/desbloquear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Desbloqueo de tarjeta bloqueada por el propio cliente (RF-07)',
  })
  desbloquear(@CurrentUser() usuario: JwtPayload) {
    return this.cardsService.desbloquearPropia(
      this.cuentaDe(usuario),
      usuario.sub,
      usuario.canal,
    );
  }

  @Post('me/cambiar-pin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cambio de PIN desde el ATM (HU-ATM-10)' })
  cambiarPin(
    @CurrentUser() usuario: JwtPayload,
    @Body() dto: CambiarPinDto,
  ) {
    return this.cardsService.cambiarPin(
      this.cuentaDe(usuario),
      usuario.sub,
      usuario.canal,
      dto,
    );
  }
}
