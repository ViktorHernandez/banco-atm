import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolUsuario } from '../users/enums/rol-usuario.enum';
import { enmascararNumero } from '../../common/utils/enmascarar.util';
import { Transaccion } from '../transactions/entities/transaccion.entity';
import { Cuenta } from './entities/cuenta.entity';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Cuenta)
    private readonly cuentaRepository: Repository<Cuenta>,
    @InjectRepository(Transaccion)
    private readonly transaccionRepository: Repository<Transaccion>,
  ) {}

  async obtenerPorId(cuentaId: string): Promise<Cuenta> {
    const cuenta = await this.cuentaRepository.findOne({
      where: { id: cuentaId },
      relations: { usuario: true },
    });

    if (!cuenta) {
      throw new NotFoundException('Cuenta no encontrada');
    }

    return cuenta;
  }

  async resumen(cuentaId: string) {
    const cuenta = await this.obtenerPorId(cuentaId);

    return {
      id: cuenta.id,
      numeroCuenta: cuenta.numeroCuenta,
      numeroCuentaEnmascarado: enmascararNumero(cuenta.numeroCuenta),
      saldo: cuenta.saldo,
      titular: cuenta.usuario?.nombreCompleto ?? null,
      creadaEn: cuenta.creadaEn,
    };
  }

  async saldo(cuentaId: string) {
    const cuenta = await this.obtenerPorId(cuentaId);

    return {
      cuentaId: cuenta.id,
      numeroCuenta: enmascararNumero(cuenta.numeroCuenta),
      saldo: cuenta.saldo,
      consultadoEn: new Date().toISOString(),
    };
  }

  async listarPorUsuario(usuarioId: string) {
    const cuentas = await this.cuentaRepository.find({
      where: { usuario: { id: usuarioId } },
      order: { creadaEn: 'ASC' },
    });

    return cuentas.map((cuenta) => ({
      id: cuenta.id,
      numeroCuenta: cuenta.numeroCuenta,
      numeroCuentaEnmascarado: enmascararNumero(cuenta.numeroCuenta),
      saldo: cuenta.saldo,
      creadaEn: cuenta.creadaEn,
    }));
  }

  async verificarPropiedad(
    cuentaIdSolicitada: string,
    usuarioId: string,
    rol: RolUsuario,
  ): Promise<void> {
    if (rol === RolUsuario.ADMINISTRADOR) {
      return;
    }

    const cuenta = await this.cuentaRepository.findOne({
      where: { id: cuentaIdSolicitada },
      relations: { usuario: true },
    });

    if (!cuenta || cuenta.usuario?.id !== usuarioId) {
      throw new ForbiddenException('No puede consultar cuentas de terceros');
    }
  }

  async movimientos(cuentaId: string, limite = 20) {
    await this.obtenerPorId(cuentaId);

    const transacciones = await this.transaccionRepository.find({
      where: [
        { cuentaOrigen: { id: cuentaId } },
        { cuentaDestino: { id: cuentaId } },
      ],
      relations: { cuentaOrigen: true, cuentaDestino: true },
      order: { fecha: 'DESC' },
      take: limite,
    });

    return transacciones.map((transaccion) => {
      const esOrigen = transaccion.cuentaOrigen?.id === cuentaId;
      const esDestino = transaccion.cuentaDestino?.id === cuentaId;

      let signo: 'CARGO' | 'ABONO' = 'CARGO';
      if (esDestino && !esOrigen) {
        signo = 'ABONO';
      }

      return {
        id: transaccion.id,
        tipo: transaccion.tipo,
        estado: transaccion.estado,
        canal: transaccion.canal,
        monto: transaccion.monto,
        signo,
        descripcion: transaccion.descripcion ?? null,
        contraparte: esOrigen
          ? transaccion.cuentaDestino
            ? enmascararNumero(transaccion.cuentaDestino.numeroCuenta)
            : null
          : transaccion.cuentaOrigen
            ? enmascararNumero(transaccion.cuentaOrigen.numeroCuenta)
            : null,
        fecha: transaccion.fecha,
      };
    });
  }
}
