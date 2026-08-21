import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { DataSource, Repository } from 'typeorm';
import { Canal } from '../../common/enums/canal.enum';
import { Tarjeta } from '../cards/entities/tarjeta.entity';
import { EstadoTarjeta } from '../cards/enums/estado-tarjeta.enum';
import { RolUsuario } from '../users/enums/rol-usuario.enum';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { enmascararNumero } from '../../common/utils/enmascarar.util';
import { Cuenta } from '../accounts/entities/cuenta.entity';
import { AuditService } from '../audit/audit.service';
import { Transaccion } from '../transactions/entities/transaccion.entity';
import { EstadoTransaccion } from '../transactions/enums/estado-transaccion.enum';
import { Usuario } from '../users/entities/usuario.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(Cuenta)
    private readonly cuentaRepository: Repository<Cuenta>,
    @InjectRepository(Transaccion)
    private readonly transaccionRepository: Repository<Transaccion>,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  async listarUsuarios() {
    const usuarios = await this.usuarioRepository.find({
      order: { creadoEn: 'ASC' },
    });

    const cuentas = await this.cuentaRepository.find({
      relations: { usuario: true },
    });

    return usuarios.map((usuario) => {
      const cuenta = cuentas.find((item) => item.usuario?.id === usuario.id);
      return {
        id: usuario.id,
        nombreCompleto: usuario.nombreCompleto,
        correo: usuario.correo,
        rol: usuario.rol,
        creadoEn: usuario.creadoEn,
        cuenta: cuenta
          ? {
              id: cuenta.id,
              numeroCuenta: cuenta.numeroCuenta,
              saldo: cuenta.saldo,
            }
          : null,
      };
    });
  }

  async obtenerUsuario(usuarioId: string) {
    const usuario = await this.usuarioRepository.findOne({
      where: { id: usuarioId },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const cuenta = await this.cuentaRepository.findOne({
      where: { usuario: { id: usuarioId } },
    });

    return {
      id: usuario.id,
      nombreCompleto: usuario.nombreCompleto,
      correo: usuario.correo,
      rol: usuario.rol,
      creadoEn: usuario.creadoEn,
      cuenta: cuenta
        ? {
            id: cuenta.id,
            numeroCuenta: cuenta.numeroCuenta,
            saldo: cuenta.saldo,
          }
        : null,
    };
  }

  async crearCliente(dto: CrearUsuarioDto, administradorId: string) {
    const correo = dto.correo.toLowerCase().trim();

    const correoExistente = await this.usuarioRepository.findOne({
      where: { correo },
    });
    if (correoExistente) {
      throw new ConflictException('Ya existe un usuario con ese correo');
    }

    const cuentaExistente = await this.cuentaRepository.findOne({
      where: { numeroCuenta: dto.numeroCuenta },
    });
    if (cuentaExistente) {
      throw new ConflictException('Ya existe una cuenta con ese número');
    }

    const resultado = await this.dataSource.transaction(async (manager) => {
      const tarjetaExistente = await manager.findOne(Tarjeta, {
        where: { numeroTarjeta: dto.numeroTarjeta },
      });
      if (tarjetaExistente) {
        throw new ConflictException('Ya existe una tarjeta con ese número');
      }

      const usuario = manager.create(Usuario, {
        nombreCompleto: dto.nombreCompleto,
        correo,
        passwordHash: await bcrypt.hash(dto.password, 10),
        rol: RolUsuario.CLIENTE,
      });
      await manager.save(Usuario, usuario);

      const cuenta = manager.create(Cuenta, {
        numeroCuenta: dto.numeroCuenta,
        saldo: dto.saldoInicial ?? 0,
        usuario,
      });
      await manager.save(Cuenta, cuenta);

      const tarjeta = manager.create(Tarjeta, {
        numeroTarjeta: dto.numeroTarjeta,
        pinHash: await bcrypt.hash(dto.pin, 10),
        estado: EstadoTarjeta.ACTIVA,
        intentosFallidos: 0,
        cuenta,
      });
      await manager.save(Tarjeta, tarjeta);

      return { usuario, cuenta, tarjeta };
    });

    await this.auditService.registrar({
      usuarioId: administradorId,
      accion: 'CLIENTE_CREADO_POR_ADMIN',
      entidadAfectada: 'Usuario',
      entidadId: resultado.usuario.id,
      canal: Canal.WEB,
      detalle: `Cuenta ${dto.numeroCuenta}`,
    });

    return {
      id: resultado.usuario.id,
      nombreCompleto: resultado.usuario.nombreCompleto,
      correo: resultado.usuario.correo,
      rol: resultado.usuario.rol,
      cuenta: {
        id: resultado.cuenta.id,
        numeroCuenta: resultado.cuenta.numeroCuenta,
        saldo: resultado.cuenta.saldo,
      },
      tarjeta: {
        id: resultado.tarjeta.id,
        numeroTarjeta: enmascararNumero(resultado.tarjeta.numeroTarjeta),
        estado: resultado.tarjeta.estado,
      },
    };
  }

  async actualizarUsuario(
    usuarioId: string,
    dto: ActualizarUsuarioDto,
    administradorId: string,
  ) {
    const usuario = await this.usuarioRepository.findOne({
      where: { id: usuarioId },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (dto.correo) {
      const correo = dto.correo.toLowerCase().trim();
      const ocupado = await this.usuarioRepository.findOne({ where: { correo } });
      if (ocupado && ocupado.id !== usuarioId) {
        throw new ConflictException('Ya existe un usuario con ese correo');
      }
      usuario.correo = correo;
    }

    if (dto.nombreCompleto) {
      usuario.nombreCompleto = dto.nombreCompleto;
    }

    await this.usuarioRepository.save(usuario);

    await this.auditService.registrar({
      usuarioId: administradorId,
      accion: 'USUARIO_ACTUALIZADO_POR_ADMIN',
      entidadAfectada: 'Usuario',
      entidadId: usuario.id,
      canal: Canal.WEB,
    });

    return this.obtenerUsuario(usuario.id);
  }

  async reporteOperaciones() {
    const transacciones = await this.transaccionRepository.find({
      relations: { cuentaOrigen: true, cuentaDestino: true },
      order: { fecha: 'DESC' },
      take: 200,
    });

    const porTipo: Record<string, { cantidad: number; montoTotal: number }> = {};
    const porCanal: Record<string, number> = {};
    let exitosas = 0;
    let fallidas = 0;
    let montoOperado = 0;

    for (const transaccion of transacciones) {
      const tipo = transaccion.tipo;
      porTipo[tipo] = porTipo[tipo] ?? { cantidad: 0, montoTotal: 0 };
      porTipo[tipo].cantidad += 1;

      porCanal[transaccion.canal] = (porCanal[transaccion.canal] ?? 0) + 1;

      if (transaccion.estado === EstadoTransaccion.EXITOSA) {
        exitosas += 1;
        porTipo[tipo].montoTotal += transaccion.monto;
        montoOperado += transaccion.monto;
      } else if (transaccion.estado === EstadoTransaccion.FALLIDA) {
        fallidas += 1;
      }
    }

    const totalCuentas = await this.cuentaRepository.count();
    const totalUsuarios = await this.usuarioRepository.count();

    return {
      generadoEn: new Date().toISOString(),
      totales: {
        usuarios: totalUsuarios,
        cuentas: totalCuentas,
        transaccionesAnalizadas: transacciones.length,
        exitosas,
        fallidas,
        montoOperado: Math.round(montoOperado * 100) / 100,
      },
      porTipo,
      porCanal,
      ultimasOperaciones: transacciones.slice(0, 20).map((transaccion) => ({
        id: transaccion.id,
        tipo: transaccion.tipo,
        estado: transaccion.estado,
        canal: transaccion.canal,
        monto: transaccion.monto,
        origen: transaccion.cuentaOrigen
          ? enmascararNumero(transaccion.cuentaOrigen.numeroCuenta)
          : null,
        destino: transaccion.cuentaDestino
          ? enmascararNumero(transaccion.cuentaDestino.numeroCuenta)
          : null,
        fecha: transaccion.fecha,
      })),
    };
  }

  async listarAuditoria(limite: number) {
    const registros = await this.auditService.listar(limite);

    return registros.map((registro) => ({
      id: registro.id,
      accion: registro.accion,
      canal: registro.canal,
      entidadAfectada: registro.entidadAfectada ?? null,
      entidadId: registro.entidadId ?? null,
      detalle: registro.detalle ?? null,
      usuario: registro.usuario
        ? {
            id: registro.usuario.id,
            nombreCompleto: registro.usuario.nombreCompleto,
          }
        : null,
      fecha: registro.fecha,
    }));
  }
}
