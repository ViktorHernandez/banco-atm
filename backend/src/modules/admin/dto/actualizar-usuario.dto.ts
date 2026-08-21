import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ActualizarUsuarioDto {
  @ApiPropertyOptional({ example: 'Cliente de Prueba C' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  nombreCompleto?: string;

  @ApiPropertyOptional({ example: 'nuevo.correo@bancoatm.test' })
  @IsOptional()
  @IsEmail({}, { message: 'El correo no tiene un formato valido' })
  correo?: string;
}
