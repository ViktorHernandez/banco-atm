import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class CambiarPinDto {
  @ApiProperty({ example: '1234' })
  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'El PIN actual debe contener entre 4 y 6 dígitos' })
  pinActual: string;

  @ApiProperty({ example: '4321' })
  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'El nuevo PIN debe contener entre 4 y 6 dígitos' })
  pinNuevo: string;
}
