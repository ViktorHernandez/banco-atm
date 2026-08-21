import {
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
import { AuthService } from './auth.service';
import { LoginAtmDto } from './dto/login-atm.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { JwtPayload } from './interfaces/jwt-payload.interface';

@ApiTags('Autenticacion')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('atm/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Autenticacion por tarjeta y PIN desde el ATM (RF-09 / HU-ATM-01)',
  })
  loginAtm(@Body() dto: LoginAtmDto) {
    return this.authService.loginAtm(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Autenticacion por credenciales para app movil, portal y administracion (RF-01 / RF-15 / HU-BE-01)',
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Perfil de la sesion actual (RNF-03)' })
  perfil(@CurrentUser() usuario: JwtPayload) {
    return this.authService.perfil(usuario);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cierre de sesion auditado (RF-19)' })
  logout(@CurrentUser() usuario: JwtPayload) {
    return this.authService.logout(usuario);
  }
}
