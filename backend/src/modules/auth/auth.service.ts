import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { Canal } from '../../common/enums/canal.enum';
import { AuditService } from '../audit/audit.service';
import { Cuenta } from '../accounts/entities/cuenta.entity';
import { Tarjeta } from '../cards/entities/tarjeta.entity';
import { EstadoTarjeta } from '../cards/enums/estado-tarjeta.enum';
import { MotivoBloqueo } from '../cards/enums/motivo-bloqueo.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { Usuario } from '../users/entities/usuario.entity';
import { LoginAtmDto } from './dto/login-atm.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  static readonly MAX_INTENTOS_FALLIDOS = 3;

  private readonly logger = new Logger('Autenticacion');

  constructor(
    @InjectRepository(Tarjeta)
    private readonly tarjetaRepository: Repository<Tarjeta>,
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(Cuenta)
    private readonly cuentaRepository: Repository<Cuenta>,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async loginAtm(dto: LoginAtmDto) {
    const tarjeta = await this.tarjetaRepository.findOne({
      where: { numeroTarjeta: dto.numeroTarjeta },
      relations: {
        cuenta: {
          usuario: true,
        },
      },
    });

    if (!tarjeta) {
      await this.auditService.registrar({
        accion: 'LOGIN_ATM_FALLIDO',
        entidadAfectada: 'Tarjeta',
        canal: Canal.ATM,
        detalle: 'Numero de tarjeta inexistente',
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (tarjeta.estado === EstadoTarjeta.BLOQUEADA) {
      throw new ForbiddenException('Tarjeta bloqueada. Contacte a su banco.');
    }

    if (tarjeta.estado === EstadoTarjeta.INACTIVA) {
      throw new ForbiddenException('Tarjeta inactiva.');
    }

    const pinValido = await bcrypt.compare(dto.pin, tarjeta.pinHash);

    if (!pinValido) {
      tarjeta.intentosFallidos += 1;

      if (tarjeta.intentosFallidos >= AuthService.MAX_INTENTOS_FALLIDOS) {
        tarjeta.estado = EstadoTarjeta.BLOQUEADA;
        tarjeta.motivoBloqueo = MotivoBloqueo.INTENTOS_FALLIDOS;
      }

      await this.tarjetaRepository.save(tarjeta);

      const usuarioId = tarjeta.cuenta?.usuario?.id;

      if (tarjeta.estado === EstadoTarjeta.BLOQUEADA) {
        await this.auditService.registrar({
          usuarioId,
          accion: 'TARJETA_BLOQUEADA_POR_INTENTOS',
          entidadAfectada: 'Tarjeta',
          entidadId: tarjeta.id,
          canal: Canal.ATM,
          detalle: `Bloqueo automatico tras ${tarjeta.intentosFallidos} intentos incorrectos de PIN`,
        });
        if (tarjeta.cuenta) {
          await this.notificationsService.registrar(
            tarjeta.cuenta.id,
            'Su tarjeta fue bloqueada automáticamente por intentos incorrectos de PIN.',
          );
        }
        throw new ForbiddenException('Tarjeta bloqueada por intentos fallidos.');
      }

      await this.auditService.registrar({
        usuarioId,
        accion: 'LOGIN_ATM_FALLIDO',
        entidadAfectada: 'Tarjeta',
        entidadId: tarjeta.id,
        canal: Canal.ATM,
        detalle: `PIN incorrecto (intento ${tarjeta.intentosFallidos} de ${AuthService.MAX_INTENTOS_FALLIDOS})`,
      });

      const intentosRestantes =
        AuthService.MAX_INTENTOS_FALLIDOS - tarjeta.intentosFallidos;

      throw new UnauthorizedException(
        `PIN incorrecto. Le quedan ${intentosRestantes} intento(s).`,
      );
    }

    if (tarjeta.intentosFallidos !== 0) {
      tarjeta.intentosFallidos = 0;
      await this.tarjetaRepository.save(tarjeta);
    }

    const usuario = tarjeta.cuenta.usuario;

    const payload: JwtPayload = {
      sub: usuario.id,
      rol: usuario.rol,
      cuentaId: tarjeta.cuenta.id,
      tarjetaId: tarjeta.id,
      canal: Canal.ATM,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    await this.auditService.registrar({
      usuarioId: usuario.id,
      accion: 'LOGIN_ATM_EXITOSO',
      entidadAfectada: 'Tarjeta',
      entidadId: tarjeta.id,
      canal: Canal.ATM,
    });

    this.logger.log(`Sesion ATM iniciada para el usuario ${usuario.id}`);

    return {
      accessToken,
      usuario: {
        id: usuario.id,
        nombreCompleto: usuario.nombreCompleto,
        rol: usuario.rol,
      },
      cuenta: {
        id: tarjeta.cuenta.id,
        numeroCuenta: tarjeta.cuenta.numeroCuenta,
      },
      tarjeta: {
        id: tarjeta.id,
        estado: tarjeta.estado,
      },
    };
  }

  async login(dto: LoginDto) {
    const canal = dto.canal ?? Canal.WEB;

    const usuario = await this.usuarioRepository.findOne({
      where: { correo: dto.correo.toLowerCase().trim() },
    });

    if (!usuario) {
      await this.auditService.registrar({
        accion: 'LOGIN_FALLIDO',
        entidadAfectada: 'Usuario',
        canal,
        detalle: 'Correo inexistente',
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordValido = await bcrypt.compare(
      dto.password,
      usuario.passwordHash,
    );

    if (!passwordValido) {
      await this.auditService.registrar({
        usuarioId: usuario.id,
        accion: 'LOGIN_FALLIDO',
        entidadAfectada: 'Usuario',
        entidadId: usuario.id,
        canal,
        detalle: 'Contrasena incorrecta',
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const cuenta = await this.cuentaRepository.findOne({
      where: { usuario: { id: usuario.id } },
    });

    const payload: JwtPayload = {
      sub: usuario.id,
      rol: usuario.rol,
      canal,
      cuentaId: cuenta?.id,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    await this.auditService.registrar({
      usuarioId: usuario.id,
      accion: 'LOGIN_EXITOSO',
      entidadAfectada: 'Usuario',
      entidadId: usuario.id,
      canal,
    });

    return {
      accessToken,
      usuario: {
        id: usuario.id,
        nombreCompleto: usuario.nombreCompleto,
        correo: usuario.correo,
        rol: usuario.rol,
      },
      cuenta: cuenta
        ? { id: cuenta.id, numeroCuenta: cuenta.numeroCuenta }
        : null,
    };
  }

  async perfil(payload: JwtPayload) {
    const usuario = await this.usuarioRepository.findOne({
      where: { id: payload.sub },
    });

    if (!usuario) {
      throw new UnauthorizedException('La sesion ya no es valida');
    }

    return {
      id: usuario.id,
      nombreCompleto: usuario.nombreCompleto,
      correo: usuario.correo,
      rol: usuario.rol,
      canal: payload.canal,
      cuentaId: payload.cuentaId ?? null,
      tarjetaId: payload.tarjetaId ?? null,
    };
  }

  async logout(payload: JwtPayload) {
    await this.auditService.registrar({
      usuarioId: payload.sub,
      accion: 'CIERRE_SESION',
      entidadAfectada: 'Usuario',
      entidadId: payload.sub,
      canal: payload.canal,
    });

    return { mensaje: 'Sesion finalizada' };
  }
}
