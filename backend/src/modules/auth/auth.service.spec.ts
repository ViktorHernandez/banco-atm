import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Canal } from '../../common/enums/canal.enum';
import { EstadoTarjeta } from '../cards/enums/estado-tarjeta.enum';
import { MotivoBloqueo } from '../cards/enums/motivo-bloqueo.enum';
import { RolUsuario } from '../users/enums/rol-usuario.enum';
import { AuthService } from './auth.service';

describe('AuthService (HU-BE-01 / HU-ATM-01 / HU-ATM-07)', () => {
  const crearTarjeta = (pinHash: string, overrides: Record<string, unknown> = {}) => ({
    id: 'tarjeta-1',
    numeroTarjeta: '4000000000000001',
    pinHash,
    estado: EstadoTarjeta.ACTIVA,
    intentosFallidos: 0,
    motivoBloqueo: null,
    cuenta: {
      id: 'cuenta-1',
      numeroCuenta: '1000000001',
      usuario: {
        id: 'usuario-1',
        nombreCompleto: 'Cliente de Prueba A',
        rol: RolUsuario.CLIENTE,
      },
    },
    ...overrides,
  });

  const construirServicio = (tarjeta: unknown) => {
    const tarjetaRepository = {
      findOne: jest.fn().mockResolvedValue(tarjeta),
      save: jest.fn().mockImplementation((valor) => Promise.resolve(valor)),
    };
    const usuarioRepository = { findOne: jest.fn() };
    const cuentaRepository = { findOne: jest.fn() };
    const jwtService = { signAsync: jest.fn().mockResolvedValue('token-firmado') };
    const auditService = { registrar: jest.fn().mockResolvedValue(undefined) };
    const notificationsService = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    const service = new AuthService(
      tarjetaRepository as never,
      usuarioRepository as never,
      cuentaRepository as never,
      jwtService as never,
      auditService as never,
      notificationsService as never,
    );

    return {
      service,
      tarjetaRepository,
      jwtService,
      auditService,
      notificationsService,
    };
  };

  it('emite un token cuando la tarjeta y el PIN son correctos', async () => {
    const pinHash = await bcrypt.hash('1234', 4);
    const { service, jwtService } = construirServicio(crearTarjeta(pinHash));

    const resultado = await service.loginAtm({
      numeroTarjeta: '4000000000000001',
      pin: '1234',
    });

    expect(resultado.accessToken).toBe('token-firmado');
    expect(resultado.cuenta.numeroCuenta).toBe('1000000001');
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ canal: Canal.ATM, cuentaId: 'cuenta-1' }),
    );
  });

  it('rechaza el acceso e incrementa los intentos cuando el PIN es incorrecto', async () => {
    const pinHash = await bcrypt.hash('1234', 4);
    const tarjeta = crearTarjeta(pinHash);
    const { service, tarjetaRepository } = construirServicio(tarjeta);

    await expect(
      service.loginAtm({ numeroTarjeta: '4000000000000001', pin: '9999' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(tarjeta.intentosFallidos).toBe(1);
    expect(tarjetaRepository.save).toHaveBeenCalled();
  });

  it('bloquea la tarjeta al alcanzar el tercer intento incorrecto (RF-14)', async () => {
    const pinHash = await bcrypt.hash('1234', 4);
    const tarjeta = crearTarjeta(pinHash, { intentosFallidos: 2 });
    const { service, notificationsService } = construirServicio(tarjeta);

    await expect(
      service.loginAtm({ numeroTarjeta: '4000000000000001', pin: '0000' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(tarjeta.intentosFallidos).toBe(3);
    expect(tarjeta.estado).toBe(EstadoTarjeta.BLOQUEADA);
    expect(tarjeta.motivoBloqueo).toBe(MotivoBloqueo.INTENTOS_FALLIDOS);
    expect(notificationsService.registrar).toHaveBeenCalled();
  });

  it('impide el acceso con una tarjeta previamente bloqueada', async () => {
    const pinHash = await bcrypt.hash('1234', 4);
    const tarjeta = crearTarjeta(pinHash, {
      estado: EstadoTarjeta.BLOQUEADA,
      motivoBloqueo: MotivoBloqueo.CLIENTE,
    });
    const { service } = construirServicio(tarjeta);

    await expect(
      service.loginAtm({ numeroTarjeta: '4000000000000001', pin: '1234' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('reinicia el contador de intentos tras una autenticacion exitosa', async () => {
    const pinHash = await bcrypt.hash('1234', 4);
    const tarjeta = crearTarjeta(pinHash, { intentosFallidos: 2 });
    const { service } = construirServicio(tarjeta);

    await service.loginAtm({ numeroTarjeta: '4000000000000001', pin: '1234' });

    expect(tarjeta.intentosFallidos).toBe(0);
  });
});
