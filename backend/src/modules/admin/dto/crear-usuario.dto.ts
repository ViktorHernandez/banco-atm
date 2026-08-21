import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CrearUsuarioDto {
  @ApiProperty({ example: 'Cliente de Prueba C' })
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  nombreCompleto: string;

  @ApiProperty({ example: 'cliente.c@bancoatm.test' })
  @IsEmail({}, { message: 'El correo no tiene un formato valido' })
  correo: string;

  @ApiProperty({ example: 'Cliente123!' })
  @IsString()
  @MinLength(6, { message: 'La contrasena debe tener al menos 6 caracteres' })
  password: string;

  @ApiProperty({ example: '1000000003' })
  @IsString()
  @Matches(/^\d{6,30}$/, {
    message: 'El número de cuenta debe contener entre 6 y 30 dígitos',
  })
  numeroCuenta: string;

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'El saldo inicial no puede ser negativo' })
  saldoInicial?: number;

  @ApiProperty({ example: '4000000000000003' })
  @IsString()
  @Matches(/^\d{13,19}$/, {
    message: 'El número de tarjeta debe contener entre 13 y 19 dígitos',
  })
  numeroTarjeta: string;

  @ApiProperty({ example: '4321' })
  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'El PIN debe contener entre 4 y 6 dígitos' })
  pin: string;
}
