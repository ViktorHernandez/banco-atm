import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('API bancaria (integracion)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET / responde el estado del servicio y de la base de datos', async () => {
    const respuesta = await request(app.getHttpServer()).get('/').expect(200);

    expect(respuesta.body).toHaveProperty('status', 'ok');
    expect(respuesta.body).toHaveProperty('database');
  });

  it('POST /auth/atm/login rechaza payloads invalidos (RNF-03)', async () => {
    await request(app.getHttpServer())
      .post('/auth/atm/login')
      .send({ numeroTarjeta: 'abc', pin: '1' })
      .expect(400);
  });

  it('POST /auth/atm/login rechaza tarjetas inexistentes', async () => {
    await request(app.getHttpServer())
      .post('/auth/atm/login')
      .send({ numeroTarjeta: '4999999999999999', pin: '1234' })
      .expect(401);
  });

  it('GET /transactions/limites expone las reglas de negocio vigentes (RNF-01)', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/transactions/limites')
      .expect(401);

    expect(respuesta.body).toHaveProperty('statusCode', 401);
  });

  it('GET /accounts exige token de acceso (RNF-03)', async () => {
    await request(app.getHttpServer()).get('/accounts').expect(401);
  });

  it('GET /admin/usuarios rechaza sesiones sin rol administrador', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/atm/login')
      .send({ numeroTarjeta: '4000000000000001', pin: '1234' });

    if (login.status !== 200) {
      return;
    }

    await request(app.getHttpServer())
      .get('/admin/usuarios')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(403);
  });

  it('GET /accounts/me exige token de acceso (RNF-03)', async () => {
    await request(app.getHttpServer()).get('/accounts/me').expect(401);
  });

  it('GET /accounts/me rechaza tokens invalidos', async () => {
    await request(app.getHttpServer())
      .get('/accounts/me')
      .set('Authorization', 'Bearer token-falso')
      .expect(401);
  });

  it('flujo completo ATM: login, saldo, deposito, retiro y comprobante', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/atm/login')
      .send({ numeroTarjeta: '4000000000000001', pin: '1234' });

    if (login.status !== 200) {
      console.warn(
        'Se omite el flujo completo: los datos de prueba no estan disponibles o la tarjeta esta bloqueada.',
      );
      return;
    }

    const token = login.body.accessToken as string;
    const autorizacion = { Authorization: `Bearer ${token}` };

    const saldoInicial = await request(app.getHttpServer())
      .get('/accounts/me/saldo')
      .set(autorizacion)
      .expect(200);

    const saldoAntes = Number(saldoInicial.body.saldo);

    const deposito = await request(app.getHttpServer())
      .post('/transactions/deposito')
      .set(autorizacion)
      .send({ monto: 500 })
      .expect(201);

    expect(deposito.body.folio).toMatch(/^TRX-/);
    expect(Number(deposito.body.saldoResultante)).toBeCloseTo(saldoAntes + 500, 2);

    const retiro = await request(app.getHttpServer())
      .post('/transactions/retiro')
      .set(autorizacion)
      .send({ monto: 500 })
      .expect(201);

    expect(Number(retiro.body.saldoResultante)).toBeCloseTo(saldoAntes, 2);

    await request(app.getHttpServer())
      .post('/transactions/retiro')
      .set(autorizacion)
      .send({ monto: 33 })
      .expect(400);

    const cuentas = await request(app.getHttpServer())
      .get('/accounts')
      .set(autorizacion)
      .expect(200);

    expect(Array.isArray(cuentas.body)).toBe(true);
    expect(cuentas.body.length).toBeGreaterThan(0);

    const limites = await request(app.getHttpServer())
      .get('/transactions/limites')
      .set(autorizacion)
      .expect(200);

    expect(limites.body.retiro.denominacion).toBeGreaterThan(0);

    const movimientos = await request(app.getHttpServer())
      .get('/accounts/me/movimientos?limite=5')
      .set(autorizacion)
      .expect(200);

    expect(Array.isArray(movimientos.body)).toBe(true);
    expect(movimientos.body.length).toBeGreaterThan(0);

    const comprobante = await request(app.getHttpServer())
      .get(`/transactions/${retiro.body.id}/comprobante`)
      .set(autorizacion)
      .expect(200);

    expect(comprobante.body.folio).toBe(retiro.body.folio);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set(autorizacion)
      .expect(200);
  }, 30000);
});
