import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cuenta } from '../accounts/entities/cuenta.entity';
import { Tarjeta } from '../cards/entities/tarjeta.entity';
import { AuditModule } from '../audit/audit.module';
import { CardsModule } from '../cards/cards.module';
import { Transaccion } from '../transactions/entities/transaccion.entity';
import { Usuario } from '../users/entities/usuario.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, Cuenta, Transaccion, Tarjeta]),
    AuditModule,
    CardsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
