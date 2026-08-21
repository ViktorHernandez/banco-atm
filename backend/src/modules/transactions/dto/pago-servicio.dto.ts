import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsPositive, IsString, Matches } from 'class-validator';

export class PagoServicioDto {
  @ApiProperty({ example: 'CFE' })
  @IsString()
  @Matches(/^[A-Za-z0-9-]{2,20}$/, {
    message: 'Código de proveedor no válido',
  })
  codigoProveedor: string;

  @ApiProperty({ example: '123456789012' })
  @IsString()
  @Matches(/^[A-Za-z0-9]{4,20}$/, {
    message: 'La referencia debe ser alfanumérica de 4 a 20 caracteres',
  })
  referencia: string;

  @ApiProperty({ example: 850 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto debe ser numérico' })
  @IsPositive({ message: 'El monto debe ser mayor a cero' })
  monto: number;
}
