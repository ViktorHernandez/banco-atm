import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { EstadoTarjeta } from '../enums/estado-tarjeta.enum';

export class ActualizarEstadoTarjetaDto {
  @ApiProperty({ enum: EstadoTarjeta })
  @IsEnum(EstadoTarjeta, { message: 'Estado de tarjeta no valido' })
  estado: EstadoTarjeta;
}
