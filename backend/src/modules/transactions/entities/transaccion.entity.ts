import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { decimalTransformer } from '../../../common/transformers/decimal.transformer';
import { Canal } from '../../../common/enums/canal.enum';
import { Cuenta } from '../../accounts/entities/cuenta.entity';
import { TipoTransaccion } from '../enums/tipo-transaccion.enum';
import { EstadoTransaccion } from '../enums/estado-transaccion.enum';

@Entity('transacciones')
export class Transaccion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: TipoTransaccion })
  tipo: TipoTransaccion;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  monto: number;

  @Column({ type: 'enum', enum: EstadoTransaccion })
  estado: EstadoTransaccion;

  @Column({ type: 'enum', enum: Canal })
  canal: Canal;

  @ManyToOne(() => Cuenta, { nullable: true })
  @JoinColumn({ name: 'cuenta_origen_id' })
  cuentaOrigen?: Cuenta;

  @ManyToOne(() => Cuenta, { nullable: true })
  @JoinColumn({ name: 'cuenta_destino_id' })
  cuentaDestino?: Cuenta;

  @Column({ type: 'varchar', nullable: true })
  descripcion?: string;

  @CreateDateColumn()
  fecha: Date;
}
