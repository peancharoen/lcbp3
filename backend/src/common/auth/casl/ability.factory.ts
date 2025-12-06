import { Injectable } from '@nestjs/common';
import { Ability, AbilityBuilder, AbilityClass } from '@casl/ability';
import { User } from '../../../modules/user/entities/user.entity';
import { UserAssignment } from '../../../modules/user/entities/user-assignment.entity';

// Define action types
type Actions = 'create' | 'read' | 'update' | 'delete' | 'manage';

// Define subject types (resources)
type Subjects =
  | 'correspondence'
  | 'rfa'
  | 'drawing'
  | 'transmittal'
  | 'circulation'
  | 'project'
  | 'organization'
  | 'user'
  | 'role'
  | 'workflow'
  | 'all';

export type AppAbility = Ability<[Actions, Subjects]>;

export interface ScopeContext {
  organizationId?: number;
  projectId?: number;
  contractId?: number;
}

@Injectable()
export class AbilityFactory {
  /**
   * สร้าง Ability object สำหรับ User ในบริบทที่กำหนด
   * รองรับ 4-Level Hierarchical RBAC:
   * - Level 1: Global (no scope)
   * - Level 2: Organization
   * - Level 3: Project
   * - Level 4: Contract
   */
  createForUser(user: User, context: ScopeContext): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(
      Ability as AbilityClass<AppAbility>
    );

    if (!user || !user.assignments) {
      // No permissions for unauthenticated or incomplete user
      return build();
    }

    // Iterate through user's role assignments
    // Iterate through user's role assignments
    user.assignments.forEach((assignment: UserAssignment) => {
      // Check if assignment matches the current context
      if (this.matchesScope(assignment, context)) {
        // Grant permissions from the role
        assignment.role.permissions?.forEach((permission) => {
          const [action, subject] = this.parsePermission(
            permission.permissionName
          );
          can(action as Actions, subject as Subjects);
        });
      }
    });

    return build({
      // Detect subject type (for future use with objects)
      detectSubjectType: (item: any) => {
        if (typeof item === 'string') return item;
        return item.constructor;
      },
    });
  }

  /**
   * ตรวจสอบว่า Assignment ตรงกับ Scope Context หรือไม่
   * Hierarchical matching:
   * - Global assignment matches all contexts
   * - Organization assignment matches if org IDs match
   * - Project assignment matches if project IDs match
   * - Contract assignment matches if contract IDs match
   */
  private matchesScope(
    assignment: UserAssignment,
    context: ScopeContext
  ): boolean {
    // Level 1: Global scope (no organizationId, projectId, contractId)
    if (
      !assignment.organizationId &&
      !assignment.projectId &&
      !assignment.contractId
    ) {
      return true; // Global admin can access everything
    }

    // Level 4: Contract scope (most specific)
    if (assignment.contractId) {
      return context.contractId === assignment.contractId;
    }

    // Level 3: Project scope
    if (assignment.projectId) {
      return context.projectId === assignment.projectId;
    }

    // Level 2: Organization scope
    if (assignment.organizationId) {
      return context.organizationId === assignment.organizationId;
    }

    return false;
  }

  /**
   * แปลง permission name เป็น [action, subject]
   * Format: "correspondence.create" → ["create", "correspondence"]
   *         "project.view" → ["view", "project"]
   */
  private parsePermission(permissionName: string): [string, string] {
    // Fallback for special permissions like "system.manage_all"
    if (permissionName === 'system.manage_all') {
      return ['manage', 'all'];
    }

    const parts = permissionName.split('.');
    if (parts.length === 2) {
      const [subject, action] = parts;
      return [action, subject];
    }

    throw new Error(`Invalid permission format: ${permissionName}`);
  }
}
