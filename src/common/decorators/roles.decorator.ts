import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../constants/roles';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify which roles can access an endpoint.
 * Usage: @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
