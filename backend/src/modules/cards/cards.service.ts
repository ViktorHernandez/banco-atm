import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { Canal } from '../../common/enums/canal.enum';
import { enmascararNumero } from '../../common/utils/enmascarar.util';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CambiarPinDto } from './dto/cambiar-pin.dto';
import { Tarjeta } from './entities/tarjeta.entity';
import { EstadoTarjeta } from './enums/estado-tarjeta.enum';
import { MotivoBloqueo } from './enums/motivo-bloqueo.enum';

@Injectable()
export class CardsService {
  private readonly logger = new Logger('Tarjetas');

  constructor(
    @InjectRepository(Tarjeta)
    private readonly tarjetaRepository: Repository<Tarjeta>,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async obtenerPorCuenta(cuentaId: string): Promise<Tarjeta> {
    const tarjeta = await this.tarjetaRepository.findOne({
      where: { cuenta: { id: cuentaId } },
      relations: { cuenta: { usuario: true } },
    });

    if (!tarjeta) {
      throw new NotFoundException('La cuenta no tiene una tarjeta asociada');
    }

    return tarjeta;
  }

  private presentar(tarjeta: Tarjeta) {
    return {
      id: tarjeta.id,
      numeroTarjeta: enmascararNumero(tarjeta.numeroTarjeta),
      estado: tarjeta.estado,
      motivoBloqueo: tarjeta.motivoBloqueo ?? null,
      intentosFallidos: tarjeta.intentosFallidos,
      emitidaEn: tarjeta.emitidaEn,
    };
  }

  async consultarPropia(cuentaId: string) {
    const tarjeta = await this.obtenerPorCuenta(cuentaId);
    return this.presentar(tarjeta);
  }

  async bloquearPropia(cuentaId: string, usuarioId: string, canal: Canal) {
    const tarjeta = await this.obtenerPorCuenta(cuentaId);

    if (tarjeta.estado === EstadoTarjeta.BLOQUEADA) {
      throw new ConflictException('La tarjeta ya se encuentra bloqueada');
    }

    tarjeta.estado = EstadoTarjeta.BLOQUEADA;
    tarjeta.motivoBloqueo = MotivoBloqueo.CLIENTE;
    await this.tarjetaRepository.save(tarjeta);

    await this.auditService.registrar({
      usuarioId,
      accion: 'TARJETA_BLOQUEADA_POR_CLIENTE',
      entidadAfectada: 'Tarjeta',
      entidadId: tarjeta.id,
      canal,
    });

    await this.notificationsService.registrar(
      cuentaId,
      'Su tarjeta fue bloqueada a solicitud suya.',
    );

    this.logger.log(`Tarjeta ${tarjeta.id} bloqueada por el cliente`);

    return this.presentar(tarjeta);
  }

  async desbloquearPropia(cuentaId: string, usuarioId: string, canal: Canal) {
    const tarjeta = await this.obtenerPorCuenta(cuentaId);

    if (tarjeta.estado !== EstadoTarjeta.BLOQUEADA) {
      throw new ConflictException('La tarjeta no se encuentra bloqueada');
    }

    if (tarjeta.motivoBloqueo !== MotivoBloqueo.CLIENTE) {
      throw new ConflictException(
        'Solo puede desbloquear una tarjeta que usted mismo bloqueo. Contacte a su banco.',
      );
    }

    tarjeta.estado = EstadoTarjeta.ACTIVA;
    tarjeta.motivoBloqueo = null;
    tarjeta.intentosFallidos = 0;
    await this.tarjetaRepository.save(tarjeta);

    await this.auditService.registrar({
      usuarioId,
      accion: 'TARJETA_DESBLOQUEADA_POR_CLIENTE',
      entidadAfectada: 'Tarjeta',
      entidadId: tarjeta.id,
      canal,
    });

    await this.notificationsService.registrar(
      cuentaId,
      'Su tarjeta fue desbloqueada correctamente.',
    );

    return this.presentar(tarjeta);
  }

  async cambiarPin(
    cuentaId: string,
    usuarioId: string,
    canal: Canal,
    dto: CambiarPinDto,
  ) {
    const tarjeta = await this.obtenerPorCuenta(cuentaId);

    if (tarjeta.estado !== EstadoTarjeta.ACTIVA) {
      throw new ConflictException(
        'Solo puede cambiar el PIN de una tarjeta activa',
      );
    }

    const pinValido = await bcrypt.compare(dto.pinActual, tarjeta.pinHash);

    if (!pinValido) {
      await this.auditService.registrar({
        usuarioId,
        accion: 'CAMBIO_PIN_FALLIDO',
        entidadAfectada: 'Tarjeta',
        entidadId: tarjeta.id,
        canal,
        detalle: 'PIN actual incorrecto',
      });
      throw new UnauthorizedException('El PIN actual es incorrecto');
    }

    if (dto.pinActual === dto.pinNuevo) {
      throw new BadRequestException(
        'El nuevo PIN debe ser diferente al PIN actual',
      );
    }

    tarjeta.pinHash = await bcrypt.hash(dto.pinNuevo, 10);
    await this.tarjetaRepository.save(tarjeta);

    await this.auditService.registrar({
      usuarioId,
      accion: 'CAMBIO_PIN_EXITOSO',
      entidadAfectada: 'Tarjeta',
      entidadId: tarjeta.id,
      canal,
    });

    await this.notificationsService.registrar(
      cuentaId,
      'El PIN de su tarjeta fue actualizado.',
    );

    return { mensaje: 'PIN actualizado correctamente' };
  }

  async listarTodas() {
    const tarjetas = await this.tarjetaRepository.find({
      relations: { cuenta: { usuario: true } },
      order: { emitidaEn: 'ASC' },
    });

    return tarjetas.map((tarjeta) => ({
      ...this.presentar(tarjeta),
      cuenta: tarjeta.cuenta
        ? {
            id: tarjeta.cuenta.id,
            numeroCuenta: tarjeta.cuenta.numeroCuenta,
            titular: tarjeta.cuenta.usuario?.nombreCompleto ?? null,
          }
        : null,
    }));
  }

  async actualizarEstadoComoAdministrador(
    tarjetaId: string,
    estado: EstadoTarjeta,
    administradorId: string,
  ) {
    const tarjeta = await this.tarjetaRepository.findOne({
      where: { id: tarjetaId },
      relations: { cuenta: true },
    });

    if (!tarjeta) {
      throw new NotFoundException('Tarjeta no encontrada');
    }

    tarjeta.estado = estado;
    tarjeta.motivoBloqueo =
      estado === EstadoTarjeta.BLOQUEADA ? MotivoBloqueo.ADMINISTRADOR : null;

    if (estado === EstadoTarjeta.ACTIVA) {
      tarjeta.intentosFallidos = 0;
    }

    await this.tarjetaRepository.save(tarjeta);

    await this.auditService.registrar({
      usuarioId: administradorId,
      accion: 'ESTADO_TARJETA_ACTUALIZADO_POR_ADMIN',
      entidadAfectada: 'Tarjeta',
      entidadId: tarjeta.id,
      canal: Canal.WEB,
      detalle: `Nuevo estado: ${estado}`,
    });

    if (tarjeta.cuenta) {
      await this.notificationsService.registrar(
        tarjeta.cuenta.id,
        `El estado de su tarjeta fue actualizado a ${estado} por el banco.`,
      );
    }

    return this.presentar(tarjeta);
  }
}
