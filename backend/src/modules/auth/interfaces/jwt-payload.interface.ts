import { Canal } from '../../../common/enums/canal.enum';
import { RolUsuario } from '../../users/enums/rol-usuario.enum';

export interface JwtPayload {
  sub: string;
  rol: RolUsuario;
  canal: Canal;
  cuentaId?: string;
  tarjetaId?: string;
}
