import { SetMetadata } from '@nestjs/common';

export enum Role {
  User            = 'user',
  Admin           = 'admin',
  SuperAdmin      = 'super_admin',
  Ops             = 'ops',
  ContentReviewer = 'content_reviewer',
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
