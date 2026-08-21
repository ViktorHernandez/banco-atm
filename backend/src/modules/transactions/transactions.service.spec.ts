import { BadRequestException, ConflictException } from '@nestjs/common';
import { Canal } from '../../common/enums/canal.enum';
import { EstadoTransaccion } from './enums/estado-transaccion.enum';
import { TipoTransaccion } from './enums/tipo-transaccion.enum';
import { TransactionsService } from './transactions.service';

describe('TransactionsService (HU-BE-04 / HU-ATM-03 / HU-ATM-04 / HU-ATM-05)', () => {
  const contexto = {
    cuentaId: 'cuenta-1',
    usuarioId: 'usuario-1',
    canal: Canal.ATM,
  };

  const construirServicio = (cuentas: Record<string, any>) => {
    const guardadas: any[] = [];

    const manager = {
      findOne: jest.fn((_entidad: unknown, opciones: any) => {
        const criterio = opciones.where;
        const encontrada = Object.values(cuentas).find((cuenta: any) =>
          criterio.id
            ? cuenta.id === criterio.id
            : cuenta.numeroCuenta === criterio.numeroCuenta,
        );
        return Promise.resolve(encontrada ?? null);
      }),
      save: jest.fn((_entidad: unknown, valor: any) => {
        guardadas.push(valor);
        return Promise.resolve(valor);
      }),
      create: jest.fn((_entidad: unknown, valor: any) => ({
        id: '11111111-2222-3333-4444-555555555555',
        fecha: new Date('2026-01-01T10:00:00.000Z'),
        ...valor,
      })),
    };

    const dataSource = {
      transaction: jest.fn((callback: (m: unknown) => Promise<unknown>) =>
        callback(manager),
      ),
    };

    const transaccionRepository = {
      create: jest.fn((valor: any) => valor),
      save: jest.fn((valor: any) => Promise.resolve(valor)),
      findOne: jest.fn(),
    };

    const auditService = { registrar: jest.fn().mockResolvedValue(undefined) };
    const notificationsService = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };
    const servicesService = {
      obtenerProveedor: jest.fn().mockReturnValue({
        codigo: 'CFE',
        nombre: 'Comision Federal de Electricidad',
        categoria: 'Energia',
        montoMinimo: 50,
        montoMaximo: 15000,
        longitudReferencia: 12,
      }),
    };

    const service = new TransactionsService(
      dataSource as never,
      transaccionRepository as never,
      auditService as never,
      notificationsService as never,
      servicesService as never,
    );

    return { service, transaccionRepository, auditService, notificationsService };
  };

  const cuentasBase = () => ({
    origen: { id: 'cuenta-1', numeroCuenta: '1000000001', saldo: 5000 },
    destino: { id: 'cuenta-2', numeroCuenta: '1000000002', saldo: 3000 },
  });

  it('descuenta el saldo y genera comprobante en un retiro valido', async () => {
    const cuentas = cuentasBase();
    const { service } = construirServicio(cuentas);

    const comprobante = await service.retirar(contexto, { monto: 500 });

    expect(cuentas.origen.saldo).toBe(4500);
    expect(comprobante.tipo).toBe(TipoTransaccion.RETIRO);
    expect(comprobante.estado).toBe(EstadoTransaccion.EXITOSA);
    expect(comprobante.saldoResultante).toBe(4500);
    expect(comprobante.folio).toMatch(/^TRX-/);
    expect(comprobante.cuentaOrigen).toBe('****0001');
  });

  it('rechaza retiros que no son multiplo de la denominacion', async () => {
    const { service } = construirServicio(cuentasBase());

    await expect(service.retirar(contexto, { monto: 120 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rechaza retiros por encima del maximo por operacion', async () => {
    const { service } = construirServicio(cuentasBase());

    await expect(
      service.retirar(contexto, { monto: TransactionsService.RETIRO_MAXIMO + 50 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza el retiro cuando el saldo es insuficiente y registra la falla', async () => {
    const cuentas = cuentasBase();
    cuentas.origen.saldo = 100;
    const { service, transaccionRepository } = construirServicio(cuentas);

    await expect(service.retirar(contexto, { monto: 500 })).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(cuentas.origen.saldo).toBe(100);
    expect(transaccionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ estado: EstadoTransaccion.FALLIDA }),
    );
  });

  it('incrementa el saldo en un deposito valido', async () => {
    const cuentas = cuentasBase();
    const { service } = construirServicio(cuentas);

    const comprobante = await service.depositar(contexto, { monto: 1000 });

    expect(cuentas.origen.saldo).toBe(6000);
    expect(comprobante.tipo).toBe(TipoTransaccion.DEPOSITO);
    expect(comprobante.cuentaDestino).toBe('****0001');
  });

  it('mueve el saldo entre ambas cuentas en una transferencia valida', async () => {
    const cuentas = cuentasBase();
    const { service, notificationsService } = construirServicio(cuentas);

    const comprobante = await service.transferir(contexto, {
      cuentaDestino: '1000000002',
      monto: 250.5,
      concepto: 'Pago de renta',
    });

    expect(cuentas.origen.saldo).toBe(4749.5);
    expect(cuentas.destino.saldo).toBe(3250.5);
    expect(comprobante.cuentaDestino).toBe('****0002');
    expect(notificationsService.registrar).toHaveBeenCalledTimes(2);
  });

  it('impide transferir a la misma cuenta', async () => {
    const { service } = construirServicio(cuentasBase());

    await expect(
      service.transferir(contexto, { cuentaDestino: '1000000001', monto: 100 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('aplica el pago de servicio dentro de los limites del proveedor', async () => {
    const cuentas = cuentasBase();
    const { service } = construirServicio(cuentas);

    const comprobante = await service.pagarServicio(contexto, {
      codigoProveedor: 'CFE',
      referencia: '123456789012',
      monto: 850,
    });

    expect(cuentas.origen.saldo).toBe(4150);
    expect(comprobante.tipo).toBe(TipoTransaccion.PAGO_SERVICIO);
    expect(comprobante.descripcion).toContain('123456789012');
  });

  it('rechaza el pago fuera del rango permitido por el proveedor', async () => {
    const { service } = construirServicio(cuentasBase());

    await expect(
      service.pagarServicio(contexto, {
        codigoProveedor: 'CFE',
        referencia: '123456789012',
        monto: 10,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
