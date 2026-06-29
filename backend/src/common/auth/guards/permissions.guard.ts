import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AbilityFactory,
  ScopeContext,
  Actions,
  Subjects,
} from '../casl/ability.factory';
import { PERMISSIONS_KEY } from '../../decorators/require-permission.decorator';
import { User } from '../../../modules/user/entities/user.entity';

interface RequestWithUser {
  user?: User;
  params: Record<string, string>;
  body: Record<string, unknown>;
  query: Record<string, unknown>;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private abilityFactory: AbilityFactory
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required permissions from decorator metadata
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()]
    );

    // If no permissions required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Extract scope context from request
    const scopeContext = this.extractScope(request);

    // Create ability for user in this context
    const ability = this.abilityFactory.createForUser(user, scopeContext);

    // Check if user has ALL required permissions
    const hasPermission = requiredPermissions.every((permission) => {
      const [action, subject] = this.parsePermission(permission);
      return ability.can(action as Actions, subject as Subjects);
    });

    if (!hasPermission) {
      throw new ForbiddenException(
        `User does not have required permissions: ${requiredPermissions.join(', ')}`
      );
    }

    return true;
  }

  /**
   * Extract scope context from request
   * Priority: params > body > query
   */
  private extractScope(request: {
    params: Record<string, string>;
    body: Record<string, unknown>;
    query: Record<string, unknown>;
  }): ScopeContext {
    const raw = {
      organizationId:
        request.params.organizationId ||
        request.body.organizationId ||
        request.query.organizationId,
      projectId:
        request.params.projectId ||
        request.body.projectId ||
        request.query.projectId,
      contractId:
        request.params.contractId ||
        request.body.contractId ||
        request.query.contractId,
    };
    return {
      organizationId: raw.organizationId
        ? Number(raw.organizationId)
        : undefined,
      projectId: raw.projectId ? Number(raw.projectId) : undefined,
      contractId: raw.contractId ? Number(raw.contractId) : undefined,
    };
  }

  /**
   * Parse permission string to [action, subject]
   * Example: "correspondence.create" → ["create", "correspondence"]
   */
  private parsePermission(permission: string): [string, string] {
    const parts = permission.split('.');
    if (parts.length === 2) {
      const [subject, action] = parts;
      return [action, subject];
    }

    // Handle special case: system.manage_all
    if (permission === 'system.manage_all') {
      return ['manage', 'all'];
    }

    throw new Error(`Invalid permission format: ${permission}`);
  }
}
