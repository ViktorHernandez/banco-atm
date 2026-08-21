import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Canal } from '../../common/enums/canal.enum';
import {
  enmascararNumero,
  generarFolio,
} from '../../common/utils/enmascarar.util';
import { AuditService } from '../audit/audit.service';
import { Cuenta } from '../accounts/entities/cuenta.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { ServicesService } from '../services/services.service';
import { DepositoDto } from './dto/deposito.dto';
import { PagoServicioDto } from './dto/pago-servicio.dto';
import { RetiroDto } from './dto/retiro.dto';
import { TransferenciaDto } from './dto/transferencia.dto';
import { Transaccion } from './entities/transaccion.entity';
import { EstadoTransaccion } from './enums/estado-transaccion.enum';
import { TipoTransaccion } from './enums/tipo-transaccion.enum';

export interface Comprobante {
  id: string;
  folio: string;
  fecha: Date;
  tipo: TipoTransaccion;
  estado: EstadoTransaccion;
  canal: Canal;
  monto: number;
  cuentaOrigen: string | null;
  cuentaDestino: string | null;
  descripcion: string | null;
  saldoResultante: number | null;
}

interface ContextoOperacion {
  cuentaId: string;
  usuarioId: string;
  canal: Canal;
}

@Injectable()
export class TransactionsService {
  static readonly RETIRO_MINIMO = 50;
  static readonly RETIRO_MAXIMO = 10000;
  static readonly RETIRO_DENOMINACION = 50;
  static readonly DEPOSITO_MINIMO = 50;
  static readonly DEPOSITO_MAXIMO = 20000;
  static readonly DEPOSITO_DENOMINACION = 50;
  static readonly TRANSFERENCIA_MAXIMA = 50000;

  private readonly logger = new Logger('Transacciones');

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Transaccion)
    private readonly transaccionRepository: Repository<Transaccion>,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly servicesService: ServicesService,
  ) {}

  obtenerLimites() {
    return {
      retiro: {
        minimo: TransactionsService.RETIRO_MINIMO,
        maximo: TransactionsService.RETIRO_MAXIMO,
        denominacion: TransactionsService.RETIRO_DENOMINACION,
      },
      deposito: {
        minimo: TransactionsService.DEPOSITO_MINIMO,
        maximo: TransactionsService.DEPOSITO_MAXIMO,
        denominacion: TransactionsService.DEPOSITO_DENOMINACION,
      },
      transferencia: {
        maximo: TransactionsService.TRANSFERENCIA_MAXIMA,
      },
    };
  }

  private construirComprobante(
    transaccion: Transaccion,
    saldoResultante: number | null,
    numeroOrigen: string | null,
    numeroDestino: string | null,
  ): Comprobante {
    return {
      id: transaccion.id,
      folio: generarFolio(transaccion.id),
      fecha: transaccion.fecha,
      tipo: transaccion.tipo,
      estado: transaccion.estado,
      canal: transaccion.canal,
      monto: transaccion.monto,
      cuentaOrigen: numeroOrigen ? enmascararNumero(numeroOrigen) : null,
      cuentaDestino: numeroDestino ? enmascararNumero(numeroDestino) : null,
      descripcion: transaccion.descripcion ?? null,
      saldoResultante,
    };
  }

  private async registrarFallida(
    contexto: ContextoOperacion,
    tipo: TipoTransaccion,
    monto: number,
    motivo: string,
  ): Promise<void> {
    try {
      const fallida = this.transaccionRepository.create({
        tipo,
        monto,
        estado: EstadoTransaccion.FALLIDA,
        canal: contexto.canal,
        cuentaOrigen: { id: contexto.cuentaId } as Cuenta,
        descripcion: motivo,
      });
      await this.transaccionRepository.save(fallida);
    } catch (error) {
      this.logger.error(
        'No se pudo registrar la transaccion fallida',
        error instanceof Error ? error.stack : String(error),
      );
    }

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      accion: `${tipo}_FALLIDO`,
      entidadAfectada: 'Cuenta',
      entidadId: contexto.cuentaId,
      canal: contexto.canal,
      detalle: motivo,
    });
  }

  private async bloquearCuenta(
    manager: EntityManager,
    cuentaId: string,
  ): Promise<Cuenta> {
    const cuenta = await manager.findOne(Cuenta, {
      where: { id: cuentaId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!cuenta) {
      throw new NotFoundException('Cuenta no encontrada');
    }

    return cuenta;
  }

  private redondear(valor: number): number {
    return Math.round(valor * 100) / 100;
  }

  async retirar(contexto: ContextoOperacion, dto: RetiroDto): Promise<Comprobante> {
    const monto = this.redondear(dto.monto);

    if (monto < TransactionsService.RETIRO_MINIMO) {
      const motivo = `El retiro mínimo es de ${TransactionsService.RETIRO_MINIMO}`;
      await this.registrarFallida(contexto, TipoTransaccion.RETIRO, monto, motivo);
      throw new BadRequestException(motivo);
    }

    if (monto > TransactionsService.RETIRO_MAXIMO) {
      const motivo = `El retiro máximo por operación es de ${TransactionsService.RETIRO_MAXIMO}`;
      await this.registrarFallida(contexto, TipoTransaccion.RETIRO, monto, motivo);
      throw new BadRequestException(motivo);
    }

    if (monto % TransactionsService.RETIRO_DENOMINACION !== 0) {
      const motivo = `El monto debe ser múltiplo de ${TransactionsService.RETIRO_DENOMINACION}`;
      await this.registrarFallida(contexto, TipoTransaccion.RETIRO, monto, motivo);
      throw new BadRequestException(motivo);
    }

    let saldoInsuficiente = false;

    try {
      const resultado = await this.dataSource.transaction(async (manager) => {
        const cuenta = await this.bloquearCuenta(manager, contexto.cuentaId);

        if (cuenta.saldo < monto) {
          saldoInsuficiente = true;
          throw new ConflictException('Saldo insuficiente para realizar el retiro');
        }

        cuenta.saldo = this.redondear(cuenta.saldo - monto);
        await manager.save(Cuenta, cuenta);

        const transaccion = manager.create(Transaccion, {
          tipo: TipoTransaccion.RETIRO,
          monto,
          estado: EstadoTransaccion.EXITOSA,
          canal: contexto.canal,
          cuentaOrigen: cuenta,
          descripcion: 'Retiro de efectivo',
        });
        await manager.save(Transaccion, transaccion);

        return { cuenta, transaccion };
      });

      await this.auditService.registrar({
        usuarioId: contexto.usuarioId,
        accion: 'RETIRO_EXITOSO',
        entidadAfectada: 'Transaccion',
        entidadId: resultado.transaccion.id,
        canal: contexto.canal,
        detalle: `Monto ${monto}`,
      });

      await this.notificationsService.registrar(
        contexto.cuentaId,
        `Retiro de ${monto.toFixed(2)} realizado en ${contexto.canal}. Saldo disponible: ${resultado.cuenta.saldo.toFixed(2)}.`,
      );

      return this.construirComprobante(
        resultado.transaccion,
        resultado.cuenta.saldo,
        resultado.cuenta.numeroCuenta,
        null,
      );
    } catch (error) {
      if (saldoInsuficiente) {
        await this.registrarFallida(
          contexto,
          TipoTransaccion.RETIRO,
          monto,
          'Saldo insuficiente',
        );
      }
      throw error;
    }
  }

  async depositar(
    contexto: ContextoOperacion,
    dto: DepositoDto,
  ): Promise<Comprobante> {
    const monto = this.redondear(dto.monto);

    if (monto < TransactionsService.DEPOSITO_MINIMO) {
      const motivo = `El depósito mínimo es de ${TransactionsService.DEPOSITO_MINIMO}`;
      await this.registrarFallida(contexto, TipoTransaccion.DEPOSITO, monto, motivo);
      throw new BadRequestException(motivo);
    }

    if (monto > TransactionsService.DEPOSITO_MAXIMO) {
      const motivo = `El depósito máximo por operación es de ${TransactionsService.DEPOSITO_MAXIMO}`;
      await this.registrarFallida(contexto, TipoTransaccion.DEPOSITO, monto, motivo);
      throw new BadRequestException(motivo);
    }

    if (monto % TransactionsService.DEPOSITO_DENOMINACION !== 0) {
      const motivo = `El monto debe ser múltiplo de ${TransactionsService.DEPOSITO_DENOMINACION}`;
      await this.registrarFallida(contexto, TipoTransaccion.DEPOSITO, monto, motivo);
      throw new BadRequestException(motivo);
    }

    const resultado = await this.dataSource.transaction(async (manager) => {
      const cuenta = await this.bloquearCuenta(manager, contexto.cuentaId);

      cuenta.saldo = this.redondear(cuenta.saldo + monto);
      await manager.save(Cuenta, cuenta);

      const transaccion = manager.create(Transaccion, {
        tipo: TipoTransaccion.DEPOSITO,
        monto,
        estado: EstadoTransaccion.EXITOSA,
        canal: contexto.canal,
        cuentaDestino: cuenta,
        descripcion: 'Depósito de efectivo',
      });
      await manager.save(Transaccion, transaccion);

      return { cuenta, transaccion };
    });

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      accion: 'DEPOSITO_EXITOSO',
      entidadAfectada: 'Transaccion',
      entidadId: resultado.transaccion.id,
      canal: contexto.canal,
      detalle: `Monto ${monto}`,
    });

    await this.notificationsService.registrar(
      contexto.cuentaId,
      `Depósito de ${monto.toFixed(2)} acreditado. Saldo disponible: ${resultado.cuenta.saldo.toFixed(2)}.`,
    );

    return this.construirComprobante(
      resultado.transaccion,
      resultado.cuenta.saldo,
      null,
      resultado.cuenta.numeroCuenta,
    );
  }

  async transferir(
    contexto: ContextoOperacion,
    dto: TransferenciaDto,
  ): Promise<Comprobante> {
    const monto = this.redondear(dto.monto);

    if (monto > TransactionsService.TRANSFERENCIA_MAXIMA) {
      const motivo = `La transferencia máxima por operación es de ${TransactionsService.TRANSFERENCIA_MAXIMA}`;
      await this.registrarFallida(
        contexto,
        TipoTransaccion.TRANSFERENCIA,
        monto,
        motivo,
      );
      throw new BadRequestException(motivo);
    }

    let motivoNegocio: string | null = null;

    try {
      const resultado = await this.dataSource.transaction(async (manager) => {
        const origen = await this.bloquearCuenta(manager, contexto.cuentaId);

        const destino = await manager.findOne(Cuenta, {
          where: { numeroCuenta: dto.cuentaDestino },
          lock: { mode: 'pessimistic_write' },
        });

        if (!destino) {
          motivoNegocio = 'La cuenta destino no existe';
          throw new NotFoundException(motivoNegocio);
        }

        if (destino.id === origen.id) {
          motivoNegocio = 'No es posible transferir a la misma cuenta';
          throw new BadRequestException(motivoNegocio);
        }

        if (origen.saldo < monto) {
          motivoNegocio = 'Saldo insuficiente';
          throw new ConflictException(
            'Saldo insuficiente para realizar la transferencia',
          );
        }

        origen.saldo = this.redondear(origen.saldo - monto);
        destino.saldo = this.redondear(destino.saldo + monto);

        await manager.save(Cuenta, origen);
        await manager.save(Cuenta, destino);

        const transaccion = manager.create(Transaccion, {
          tipo: TipoTransaccion.TRANSFERENCIA,
          monto,
          estado: EstadoTransaccion.EXITOSA,
          canal: contexto.canal,
          cuentaOrigen: origen,
          cuentaDestino: destino,
          descripcion: dto.concepto ?? 'Transferencia entre cuentas',
        });
        await manager.save(Transaccion, transaccion);

        return { origen, destino, transaccion };
      });

      await this.auditService.registrar({
        usuarioId: contexto.usuarioId,
        accion: 'TRANSFERENCIA_EXITOSA',
        entidadAfectada: 'Transaccion',
        entidadId: resultado.transaccion.id,
        canal: contexto.canal,
        detalle: `Monto ${monto} hacia ${enmascararNumero(resultado.destino.numeroCuenta)}`,
      });

      await this.notificationsService.registrar(
        contexto.cuentaId,
        `Transferencia de ${monto.toFixed(2)} enviada a ${enmascararNumero(resultado.destino.numeroCuenta)}. Saldo disponible: ${resultado.origen.saldo.toFixed(2)}.`,
      );

      await this.notificationsService.registrar(
        resultado.destino.id,
        `Recibió una transferencia de ${monto.toFixed(2)} desde ${enmascararNumero(resultado.origen.numeroCuenta)}.`,
      );

      return this.construirComprobante(
        resultado.transaccion,
        resultado.origen.saldo,
        resultado.origen.numeroCuenta,
        resultado.destino.numeroCuenta,
      );
    } catch (error) {
      if (motivoNegocio) {
        await this.registrarFallida(
          contexto,
          TipoTransaccion.TRANSFERENCIA,
          monto,
          motivoNegocio,
        );
      }
      throw error;
    }
  }

  async pagarServicio(
    contexto: ContextoOperacion,
    dto: PagoServicioDto,
  ): Promise<Comprobante> {
    const proveedor = this.servicesService.obtenerProveedor(dto.codigoProveedor);
    const monto = this.redondear(dto.monto);

    if (monto < proveedor.montoMinimo || monto > proveedor.montoMaximo) {
      const motivo = `El monto para ${proveedor.nombre} debe estar entre ${proveedor.montoMinimo} y ${proveedor.montoMaximo}`;
      await this.registrarFallida(
        contexto,
        TipoTransaccion.PAGO_SERVICIO,
        monto,
        motivo,
      );
      throw new BadRequestException(motivo);
    }

    let saldoInsuficiente = false;

    try {
      const resultado = await this.dataSource.transaction(async (manager) => {
        const cuenta = await this.bloquearCuenta(manager, contexto.cuentaId);

        if (cuenta.saldo < monto) {
          saldoInsuficiente = true;
          throw new ConflictException('Saldo insuficiente para realizar el pago');
        }

        cuenta.saldo = this.redondear(cuenta.saldo - monto);
        await manager.save(Cuenta, cuenta);

        const transaccion = manager.create(Transaccion, {
          tipo: TipoTransaccion.PAGO_SERVICIO,
          monto,
          estado: EstadoTransaccion.EXITOSA,
          canal: contexto.canal,
          cuentaOrigen: cuenta,
          descripcion: `Pago de servicio ${proveedor.nombre} · Ref. ${dto.referencia}`,
        });
        await manager.save(Transaccion, transaccion);

        return { cuenta, transaccion };
      });

      await this.auditService.registrar({
        usuarioId: contexto.usuarioId,
        accion: 'PAGO_SERVICIO_EXITOSO',
        entidadAfectada: 'Transaccion',
        entidadId: resultado.transaccion.id,
        canal: contexto.canal,
        detalle: `${proveedor.codigo} referencia ${dto.referencia} monto ${monto}`,
      });

      await this.notificationsService.registrar(
        contexto.cuentaId,
        `Pago de ${monto.toFixed(2)} a ${proveedor.nombre} aplicado. Saldo disponible: ${resultado.cuenta.saldo.toFixed(2)}.`,
      );

      return this.construirComprobante(
        resultado.transaccion,
        resultado.cuenta.saldo,
        resultado.cuenta.numeroCuenta,
        null,
      );
    } catch (error) {
      if (saldoInsuficiente) {
        await this.registrarFallida(
          contexto,
          TipoTransaccion.PAGO_SERVICIO,
          monto,
          'Saldo insuficiente',
        );
      }
      throw error;
    }
  }

  async obtenerComprobante(
    transaccionId: string,
    cuentaId: string | undefined,
  ): Promise<Comprobante> {
    const transaccion = await this.transaccionRepository.findOne({
      where: { id: transaccionId },
      relations: { cuentaOrigen: true, cuentaDestino: true },
    });

    if (!transaccion) {
      throw new NotFoundException('Transacción no encontrada');
    }

    const participa =
      transaccion.cuentaOrigen?.id === cuentaId ||
      transaccion.cuentaDestino?.id === cuentaId;

    if (!participa) {
      throw new NotFoundException('Transacción no encontrada');
    }

    const cuentaReferencia =
      transaccion.cuentaOrigen?.id === cuentaId
        ? transaccion.cuentaOrigen
        : transaccion.cuentaDestino;

    return this.construirComprobante(
      transaccion,
      cuentaReferencia ? cuentaReferencia.saldo : null,
      transaccion.cuentaOrigen?.numeroCuenta ?? null,
      transaccion.cuentaDestino?.numeroCuenta ?? null,
    );
  }
}
