import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class LoginAtmDto {
  @ApiProperty({ example: '4000000000000001' })
  @IsString()
  @Matches(/^\d{13,19}$/, {
    message: 'El número de tarjeta debe contener entre 13 y 19 dígitos',
  })
  numeroTarjeta: string;

  @ApiProperty({ example: '1234' })
  @IsString()
  @Matches(/^\d{4,6}$/, {
    message: 'El PIN debe contener entre 4 y 6 dígitos',
  })
  pin: string;
}
