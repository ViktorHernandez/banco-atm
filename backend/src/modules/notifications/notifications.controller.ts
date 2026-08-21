import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { NotificationsService } from './notifications.service';
import { BadRequestException } from '@nestjs/common';

@ApiTags('Notificaciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Notificaciones de la cuenta autenticada (RF-08 / HU-BE-07)',
  })
  listarPropias(
    @CurrentUser() usuario: JwtPayload,
    @Query('limite') limite?: string,
  ) {
    if (!usuario.cuentaId) {
      throw new BadRequestException('La sesion no tiene una cuenta asociada');
    }
    const take = Number(limite) > 0 ? Math.min(Number(limite), 100) : 50;
    return this.notificationsService.listarPorCuenta(usuario.cuentaId, take);
  }
}
