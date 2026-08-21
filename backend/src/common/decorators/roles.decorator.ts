import { SetMetadata } from '@nestjs/common';
import { RolUsuario } from '../../modules/users/enums/rol-usuario.enum';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: RolUsuario[]) => SetMetadata(ROLES_KEY, roles);
