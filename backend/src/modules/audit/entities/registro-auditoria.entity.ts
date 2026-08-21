import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Canal } from '../../../common/enums/canal.enum';
import { Usuario } from '../../users/entities/usuario.entity';

@Entity('registros_auditoria')
export class RegistroAuditoria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'usuario_id' })
  usuario?: Usuario;

  @Column({ type: 'varchar' })
  accion: string;

  @Column({ type: 'varchar', nullable: true })
  entidadAfectada?: string;

  @Column({ type: 'varchar', nullable: true })
  entidadId?: string;

  @Column({ type: 'enum', enum: Canal })
  canal: Canal;

  @Column({ type: 'varchar', nullable: true })
  detalle?: string;

  @CreateDateColumn()
  fecha: Date;
}
