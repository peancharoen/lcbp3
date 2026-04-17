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
import { UserService } from '../../../modules/user/user.service';
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
    const user = request.user;

    // ดึงสิทธิ์ทั้งหมดของ User จาก DB (ตาม pattern เดียวกับ RbacGuard)
    const userPermissions = await this.userService.getUserPermissions(
      user.user_id
    );

    // Level 1: Superadmin — ผ่านทุกการตรวจสอบ
    if (userPermissions.includes('system.manage_all')) {
      return true;
    }

    // ดึง Instance เพื่อตรวจสอบ Context
    const instance = await this.instanceRepo.findOne({
      where: { id: instanceId },
    });

    if (!instance) {
      throw new NotFoundException('Workflow Instance', instanceId);
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

    // Level 3: Assigned Handler — User นี้ถูก Assign มาให้ทำ Step นี้โดยตรง
    const assignedUserId = instance.context?.assignedUserId as
      | number
      | undefined;
    if (assignedUserId !== undefined && user.user_id === assignedUserId) {
      return true;
    }

    this.logger.warn(
      `Unauthorized transition attempt: User ${user.user_id} on Instance ${instanceId}`
    );
    throw new ForbiddenException({
      userMessage: 'คุณไม่มีสิทธิ์ดำเนินการในขั้นตอนนี้',
      recoveryAction: 'ติดต่อผู้รับผิดชอบหรือ Admin หากคิดว่านี่เป็นข้อผิดพลาด',
    });
  }
}
