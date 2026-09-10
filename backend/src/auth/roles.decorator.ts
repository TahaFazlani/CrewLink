import { SetMetadata } from '@nestjs/common';
import type { MemberRole } from '../common/enums';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: MemberRole[]) => SetMetadata(ROLES_KEY, roles);
