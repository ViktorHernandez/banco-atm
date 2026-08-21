import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Cuenta } from '../../accounts/entities/cuenta.entity';
import { EstadoTarjeta } from '../enums/estado-tarjeta.enum';
import { MotivoBloqueo } from '../enums/motivo-bloqueo.enum';

@Entity('tarjetas')
export class Tarjeta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  numeroTarjeta: string;

  @Column({ type: 'varchar' })
  pinHash: string;

  @Column({ type: 'enum', enum: EstadoTarjeta, default: EstadoTarjeta.ACTIVA })
  estado: EstadoTarjeta;

  @Column({ type: 'int', default: 0 })
  intentosFallidos: number;

  @Column({
    name: 'motivoBloqueo',
    type: 'enum',
    enum: MotivoBloqueo,
    nullable: true,
  })
  motivoBloqueo?: MotivoBloqueo | null;

  @OneToOne(() => Cuenta)
  @JoinColumn({ name: 'cuenta_id' })
  cuenta: Cuenta;

  @CreateDateColumn()
  emitidaEn: Date;
}
