import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Notificacion } from './entities/notificacion.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notificaciones');

  constructor(
    @InjectRepository(Notificacion)
    private readonly notificacionRepository: Repository<Notificacion>,
  ) {}

  async registrar(
    cuentaId: string,
    mensaje: string,
    manager?: EntityManager,
  ): Promise<void> {
    const repositorio = manager
      ? manager.getRepository(Notificacion)
      : this.notificacionRepository;

    try {
      const notificacion = repositorio.create({
        cuenta: { id: cuentaId } as never,
        mensaje,
      });
      await repositorio.save(notificacion);
      this.logger.log(`Notificacion generada para cuenta ${cuentaId}`);
    } catch (error) {
      this.logger.error(
        `No se pudo generar la notificacion para la cuenta ${cuentaId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async listarPorCuenta(cuentaId: string, limite = 50) {
    const notificaciones = await this.notificacionRepository.find({
      where: { cuenta: { id: cuentaId } },
      order: { creadaEn: 'DESC' },
      take: limite,
    });

    return notificaciones.map((notificacion) => ({
      id: notificacion.id,
      mensaje: notificacion.mensaje,
      creadaEn: notificacion.creadaEn,
    }));
  }
}
