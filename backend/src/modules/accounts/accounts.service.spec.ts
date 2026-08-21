import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RolUsuario } from '../users/enums/rol-usuario.enum';
import { AccountsService } from './accounts.service';

describe('AccountsService (HU-BE-02 / HU-BE-03 / RNF-03)', () => {
  const cuentaPropia = {
    id: 'cuenta-1',
    numeroCuenta: '1000000001',
    saldo: 5000,
    creadaEn: new Date('2026-01-01T00:00:00.000Z'),
    usuario: { id: 'usuario-1', nombreCompleto: 'Cliente de Prueba A' },
  };

  const cuentaAjena = {
    id: 'cuenta-2',
    numeroCuenta: '1000000002',
    saldo: 3000,
    creadaEn: new Date('2026-01-01T00:00:00.000Z'),
    usuario: { id: 'usuario-2', nombreCompleto: 'Cliente de Prueba B' },
  };

  const construirServicio = (cuentas: any[], transacciones: any[] = []) => {
    const cuentaRepository = {
      findOne: jest.fn(({ where }: any) =>
        Promise.resolve(
          cuentas.find((cuenta) =>
            where.id ? cuenta.id === where.id : cuenta.usuario.id === where.usuario.id,
          ) ?? null,
        ),
      ),
      find: jest.fn(({ where }: any) =>
        Promise.resolve(
          cuentas.filter((cuenta) => cuenta.usuario.id === where.usuario.id),
        ),
      ),
    };

    const transaccionRepository = {
      find: jest.fn().mockResolvedValue(transacciones),
    };

    return new AccountsService(
      cuentaRepository as never,
      transaccionRepository as never,
    );
  };

  it('devuelve el saldo con el numero de cuenta enmascarado', async () => {
    const service = construirServicio([cuentaPropia]);

    const resultado = await service.saldo('cuenta-1');

    expect(resultado.saldo).toBe(5000);
    expect(resultado.numeroCuenta).toBe('****0001');
  });

  it('lista unicamente las cuentas del usuario autenticado', async () => {
    const service = construirServicio([cuentaPropia, cuentaAjena]);

    const resultado = await service.listarPorUsuario('usuario-1');

    expect(resultado).toHaveLength(1);
    expect(resultado[0].numeroCuenta).toBe('1000000001');
  });

  it('permite al titular consultar su propia cuenta', async () => {
    const service = construirServicio([cuentaPropia, cuentaAjena]);

    await expect(
      service.verificarPropiedad('cuenta-1', 'usuario-1', RolUsuario.CLIENTE),
    ).resolves.toBeUndefined();
  });

  it('impide a un cliente consultar la cuenta de otro titular (RNF-03)', async () => {
    const service = construirServicio([cuentaPropia, cuentaAjena]);

    await expect(
      service.verificarPropiedad('cuenta-2', 'usuario-1', RolUsuario.CLIENTE),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('permite al administrador consultar cualquier cuenta', async () => {
    const service = construirServicio([cuentaPropia, cuentaAjena]);

    await expect(
      service.verificarPropiedad('cuenta-2', 'admin-1', RolUsuario.ADMINISTRADOR),
    ).resolves.toBeUndefined();
  });

  it('rechaza una cuenta inexistente', async () => {
    const service = construirServicio([cuentaPropia]);

    await expect(service.obtenerPorId('cuenta-9')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('clasifica los movimientos como cargo o abono segun la cuenta consultada', async () => {
    const transacciones = [
      {
        id: 't1',
        tipo: 'TRANSFERENCIA',
        estado: 'EXITOSA',
        canal: 'ATM',
        monto: 250,
        descripcion: 'Pago de renta',
        fecha: new Date(),
        cuentaOrigen: cuentaPropia,
        cuentaDestino: cuentaAjena,
      },
      {
        id: 't2',
        tipo: 'DEPOSITO',
        estado: 'EXITOSA',
        canal: 'ATM',
        monto: 1000,
        descripcion: 'Depósito de efectivo',
        fecha: new Date(),
        cuentaOrigen: null,
        cuentaDestino: cuentaPropia,
      },
    ];

    const service = construirServicio([cuentaPropia, cuentaAjena], transacciones);

    const resultado = await service.movimientos('cuenta-1', 10);

    expect(resultado[0].signo).toBe('CARGO');
    expect(resultado[0].contraparte).toBe('****0002');
    expect(resultado[1].signo).toBe('ABONO');
  });
});
