// File: src/modules/workflow-engine/guards/workflow-transition.guard.ts
// Guard ตรวจสอบสิทธิ์ 4-Level RBAC สำหรับ Workflow Transition ตาม ADR-021 §6

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { WorkflowInstance } from '../entities/workflow-instance.entity';
import { CompiledWorkflow } from '../workflow-dsl.service';
import { UserService } from '../../../modules/user/user.service';

// FR-002a: DSL require.role → CASL ability สตาติก mapping (research.md Decision 2)
// 'ไม่รู้จัก' DSL role → fall through ไป Level 3 (assignedUserId) check
const DSL_ROLE_TO_CASL: Record<string, string> = {
  Superadmin: 'system.manage_all',
  OrgAdmin: 'organization.manage_users',
  ContractMember: 'contract.view',
  AssignedHandler: '__assigned__', // ไม่ map ไป CASL — จัดการโดย Level 3 check
};
import type { RequestWithUser } from '../../../common/interfaces/request-with-user.interface';

/**
 * WorkflowTransitionGuard — ตรวจสอบสิทธิ์ 4 ระดับก่อนอนุญาตให้เปลี่ยนสถานะ Workflow
 *
 * Level 1:   system.manage_all (Superadmin) → ผ่านทันที
 * Level 2:   organization.manage_users + สังกัดองค์กรเดียวกับเอกสาร → ผ่าน
 * Level 2.5: [C3] contract_organizations membership — ถ้า instance.contractId ถูกตั้ง
 *             และ User ไม่อยู่ใน contract นั้น → ForbiddenException (cross-contract block)
 * Level 3:   Assigned Handler (context.assignedUserId === req.user.user_id) → ผ่าน
 * Level 4:   ผู้ใช้ทั่วไป → ForbiddenException
 */
@Injectable()
export class WorkflowTransitionGuard implements CanActivate {
  private readonly logger = new Logger(WorkflowTransitionGuard.name);

  constructor(
    @InjectRepository(WorkflowInstance)
    private readonly instanceRepo: Repository<WorkflowInstance>,
    private readonly userService: UserService,
    private readonly dataSource: DataSource
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const instanceId = request.params['id'];
    // FR-002a: action \u0e2a\u0e33\u0e2b\u0e23\u0e31\u0e1a DSL role check (\u0e15\u0e23\u0e27\u0e08\u0e2a\u0e2d\u0e1a requirements.roles \u0e02\u0e2d\u0e07 transition \u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u0e17\u0e33)
    const action = (request.body as { action?: string }).action ?? '';
    const user = request.user;

    // ดึงสิทธิ์ทั้งหมดของ User จาก DB (ตาม pattern เดียวกับ RbacGuard)
    const userPermissions = await this.userService.getUserPermissions(
      user.user_id
    );

    // Level 1: Superadmin — ผ่านทุกการตรวจสอบ
    if (userPermissions.includes('system.manage_all')) {
      return true;
    }

    // ดึง Instance + Definition เพื่อตรวจสอบ Context และ DSL require.role
    const instance = await this.instanceRepo.findOne({
      where: { id: instanceId },
      relations: ['definition'],
    });

    if (!instance) {
      throw new NotFoundException('Workflow Instance', instanceId);
    }

    // FR-002a: DSL require.role → CASL ability check
    // ตรวจสอบ requirements.roles ของ CompiledTransition ที่ตรงกับ action ที่ Request ขอ
    // (ยังต้องผ่าน contract membership check Level 2.5)
    // NOTE: ต้อง cast ผ่าน unknown ก่อน เพราะ entity type เป็น Record<string,unknown>
    // ซึ่งไม่ overlap กับ CompiledWorkflow เพียงพอสำหรับ direct cast (TS2352)
    const compiled = instance.definition?.compiled as unknown as
      | CompiledWorkflow
      | undefined;
    const stateConfig = compiled?.states?.[instance.currentState];
    // CompiledTransition.requirements.roles — ไม่ใช่ stateConfig.require (ซึ่งไม่มี)
    const requiredDslRoles: string[] =
      stateConfig?.transitions?.[action]?.requirements?.roles ?? [];
    let dslRoleAuthorized = false;
    for (const dslRole of requiredDslRoles) {
      const caslAbility = DSL_ROLE_TO_CASL[dslRole];
      if (caslAbility && caslAbility !== '__assigned__') {
        if (userPermissions.includes(caslAbility)) {
          dslRoleAuthorized = true;
          break;
        }
      }
    }

    // Level 2: Org Admin — organization.manage_users + สังกัดองค์กรเดียวกับเอกสาร
    const docOrgId = instance.context?.organizationId as number | undefined;
    if (
      userPermissions.includes('organization.manage_users') &&
      docOrgId !== undefined &&
      user.primaryOrganizationId === docOrgId
    ) {
      return true;
    }

    // Level 2.5: [C3] Contract Membership check — ถ้า instance ผูกกับ contract ใด
    // User ต้องสังกัดองค์กรที่อยู่ใน contract นั้น ป้องกัน cross-contract access
    if (instance.contractId !== null && instance.contractId !== undefined) {
      const userOrgId = user.primaryOrganizationId;
      if (!userOrgId) {
        this.logger.warn(
          `No org for User ${user.user_id} attempting contract-scoped workflow ${instanceId}`
        );
        throw new ForbiddenException({
          userMessage:
            'คุณไม่ได้สังกัดองค์กรใด ไม่สามารถดำเนินการในสัญญานี้ได้',
          recoveryAction: 'ติดต่อ Admin เพื่อกำหนดองค์กร',
        });
      }
      const rows = await this.dataSource.query<[{ cnt: string }]>(
        'SELECT COUNT(*) AS cnt FROM contract_organizations WHERE contract_id = ? AND organization_id = ?',
        [instance.contractId, userOrgId]
      );
      if (Number(rows[0]?.cnt ?? 0) === 0) {
        this.logger.warn(
          `Cross-contract access attempt: User ${user.user_id} (Org ${userOrgId}) on Contract ${instance.contractId} Instance ${instanceId}`
        );
        throw new ForbiddenException({
          userMessage: 'คุณไม่มีสิทธิ์เข้าถึง Workflow ของสัญญานี้',
          recoveryAction: 'ตรวจสอบสิทธิ์กับ Project Admin',
        });
      }
    }

    // Level 3: Assigned Handler หรือ DSL CASL-authorized role
    // FR-002a: ถ้า DSL require.role ตรงกับ CASL ability ของ User → ผ่าน
    // (กรณี AssignedHandler ใน DSL → ตรวจสอบผ่าน assignedUserId ใน context)
    const assignedUserId = instance.context?.assignedUserId as
      | number
      | undefined;
    if (
      dslRoleAuthorized ||
      (assignedUserId !== undefined && user.user_id === assignedUserId)
    ) {
      return true;
    }

    this.logger.warn(
      `Unauthorized transition attempt: User ${user.user_id} on Instance ${instanceId} (DSL roles: [${requiredDslRoles.join(', ')}])`
    );
    throw new ForbiddenException({
      userMessage: 'คุณไม่มีสิทธิ์ดำเนินการในขั้นตอนนี้',
      recoveryAction: 'ติดต่อผู้รับผิดชอบหรือ Admin หากคิดว่านี่เป็นข้อผิดพลาด',
    });
  }
}
