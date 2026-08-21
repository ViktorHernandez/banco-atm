import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class TransferenciaDto {
  @ApiProperty({ example: '1000000002' })
  @IsString()
  @Matches(/^\d{6,30}$/, {
    message: 'El número de cuenta destino debe contener entre 6 y 30 dígitos',
  })
  cuentaDestino: string;

  @ApiProperty({ example: 250.5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto debe ser numérico' })
  @IsPositive({ message: 'El monto debe ser mayor a cero' })
  monto: number;

  @ApiPropertyOptional({ example: 'Pago de renta' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  concepto?: string;
}
