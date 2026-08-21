import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Canal } from '../../common/enums/canal.enum';
import { Usuario } from '../users/entities/usuario.entity';
import { RegistroAuditoria } from './entities/registro-auditoria.entity';

export interface EventoAuditoria {
  usuarioId?: string;
  accion: string;
  entidadAfectada?: string;
  entidadId?: string;
  canal: Canal;
  detalle?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('Auditoria');

  constructor(
    @InjectRepository(RegistroAuditoria)
    private readonly registroRepository: Repository<RegistroAuditoria>,
  ) {}

  async registrar(
    evento: EventoAuditoria,
    manager?: EntityManager,
  ): Promise<void> {
    const repositorio = manager
      ? manager.getRepository(RegistroAuditoria)
      : this.registroRepository;

    try {
      const registro = repositorio.create({
        usuario: evento.usuarioId
          ? ({ id: evento.usuarioId } as Usuario)
          : undefined,
        accion: evento.accion,
        entidadAfectada: evento.entidadAfectada,
        entidadId: evento.entidadId,
        canal: evento.canal,
        detalle: evento.detalle,
      });
      await repositorio.save(registro);
      this.logger.log(
        `${evento.canal} :: ${evento.accion} :: ${evento.entidadAfectada ?? '-'} ${evento.entidadId ?? ''}`,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo registrar el evento de auditoria ${evento.accion}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async listar(limite = 100): Promise<RegistroAuditoria[]> {
    return this.registroRepository.find({
      relations: { usuario: true },
      order: { fecha: 'DESC' },
      take: limite,
    });
  }
}
