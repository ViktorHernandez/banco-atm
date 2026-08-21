import { config } from 'dotenv';
import * as bcrypt from 'bcryptjs';
import { AppDataSource } from '../../config/typeorm.datasource';
import { Usuario } from '../../modules/users/entities/usuario.entity';
import { RolUsuario } from '../../modules/users/enums/rol-usuario.enum';
import { Cuenta } from '../../modules/accounts/entities/cuenta.entity';
import { Tarjeta } from '../../modules/cards/entities/tarjeta.entity';
import { EstadoTarjeta } from '../../modules/cards/enums/estado-tarjeta.enum';

config();

async function seed() {
  await AppDataSource.initialize();

  const usuarioRepository = AppDataSource.getRepository(Usuario);
  const cuentaRepository = AppDataSource.getRepository(Cuenta);
  const tarjetaRepository = AppDataSource.getRepository(Tarjeta);

  const clientesData = [
    {
      nombreCompleto: 'Cliente de Prueba A',
      correo: 'cliente.a@bancoatm.test',
      password: 'Cliente123!',
      numeroCuenta: '1000000001',
      saldo: 5000,
      numeroTarjeta: '4000000000000001',
      pin: '1234',
    },
    {
      nombreCompleto: 'Cliente de Prueba B',
      correo: 'cliente.b@bancoatm.test',
      password: 'Cliente123!',
      numeroCuenta: '1000000002',
      saldo: 3000,
      numeroTarjeta: '4000000000000002',
      pin: '5678',
    },
  ];

  const administradorData = {
    nombreCompleto: 'Administrador del Banco',
    correo: 'admin@bancoatm.test',
    password: 'Admin123!',
  };

  const administradorExistente = await usuarioRepository.findOne({
    where: { correo: administradorData.correo },
  });

  if (!administradorExistente) {
    const administrador = usuarioRepository.create({
      nombreCompleto: administradorData.nombreCompleto,
      correo: administradorData.correo,
      passwordHash: await bcrypt.hash(administradorData.password, 10),
      rol: RolUsuario.ADMINISTRADOR,
    });
    await usuarioRepository.save(administrador);
  }

  for (const datos of clientesData) {
    const existente = await usuarioRepository.findOne({
      where: { correo: datos.correo },
    });
    if (existente) {
      continue;
    }

    const usuario = usuarioRepository.create({
      nombreCompleto: datos.nombreCompleto,
      correo: datos.correo,
      passwordHash: await bcrypt.hash(datos.password, 10),
      rol: RolUsuario.CLIENTE,
    });
    await usuarioRepository.save(usuario);

    const cuenta = cuentaRepository.create({
      numeroCuenta: datos.numeroCuenta,
      saldo: datos.saldo,
      usuario,
    });
    await cuentaRepository.save(cuenta);

    const tarjeta = tarjetaRepository.create({
      numeroTarjeta: datos.numeroTarjeta,
      pinHash: await bcrypt.hash(datos.pin, 10),
      estado: EstadoTarjeta.ACTIVA,
      intentosFallidos: 0,
      cuenta,
    });
    await tarjetaRepository.save(tarjeta);
  }

  console.log('Seed completado');
  await AppDataSource.destroy();
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });