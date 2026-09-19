import {
  Injectable, CanActivate, ExecutionContext, ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { ROLES_KEY, Role } from '../../../common/decorators/roles.decorator';
import { AdminUser } from '../../../database/entities/admin-user.entity';
import { AdminRole } from '../../../database/entities/admin-user.entity';
import { Request } from 'express';

@Injectable()
export class AdminJwtGuard extends AuthGuard('admin-jwt') implements CanActivate {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context) as boolean | Promise<boolean> | Observable<boolean>;
  }
}

@Injectable()
export class AdminRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request & { user: AdminUser }>();
    const admin = req.user;

    if (!admin) throw new ForbiddenException('No admin credentials');

    // super_admin bypasses all role checks
    if (admin.role === AdminRole.SUPER_ADMIN) return true;

    const hasRole = requiredRoles.some((r) => admin.role === (r as unknown as AdminRole));
    if (!hasRole) throw new ForbiddenException('Insufficient role');

    return true;
  }
}
