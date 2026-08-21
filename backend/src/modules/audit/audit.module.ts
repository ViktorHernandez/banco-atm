import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RegistroAuditoria } from './entities/registro-auditoria.entity';
import { AuditService } from './audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([RegistroAuditoria])],
  providers: [AuditService],
  exports: [TypeOrmModule, AuditService],
})
export class AuditModule {}
