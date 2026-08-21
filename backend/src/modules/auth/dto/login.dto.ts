import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Canal } from '../../../common/enums/canal.enum';

export class LoginDto {
  @ApiProperty({ example: 'cliente.a@bancoatm.test' })
  @IsEmail({}, { message: 'El correo no tiene un formato valido' })
  correo: string;

  @ApiProperty({ example: 'Cliente123!' })
  @IsString()
  @MinLength(6, { message: 'La contrasena debe tener al menos 6 caracteres' })
  password: string;

  @ApiPropertyOptional({ enum: Canal, default: Canal.WEB })
  @IsOptional()
  @IsEnum(Canal)
  canal?: Canal;
}
