// File: src/modules/dashboard/dashboard.service.ts
// บันทึกการแก้ไข: สร้างใหม่สำหรับ Dashboard Business Logic

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

// Entities
import { Correspondence } from '../correspondence/entities/correspondence.entity';
import { AuditLog } from '../../common/entities/audit-log.entity';
import {
  WorkflowInstance,
  WorkflowStatus,
} from '../workflow-engine/entities/workflow-instance.entity';

// DTOs
import {
  DashboardStatsDto,
  GetActivityDto,
  ActivityItemDto,
  GetPendingDto,
  PendingTaskItemDto,
  GetStatsDto,
} from './dto';
import { Project } from '../project/entities/project.entity';
import { UserAssignment } from '../user/entities/user-assignment.entity';
import {
  NotFoundException,
  PermissionException,
} from '../../common/exceptions';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(Correspondence)
    private correspondenceRepo: Repository<Correspondence>,
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
    @InjectRepository(WorkflowInstance)
    private workflowInstanceRepo: Repository<WorkflowInstance>,
    @InjectRepository(Project)
    private projectRepo: Repository<Project>,
    @InjectRepository(UserAssignment)
    private userAssignmentRepo: Repository<UserAssignment>,
    private dataSource: DataSource
  ) {}

  /**
   * ตรวจสอบว่า User มีสิทธิเข้าถึงโครงการหรือไม่
   */
  private async checkProjectAccess(
    userId: number,
    projectId: string
  ): Promise<number> {
    // 1. หา Internal ID ของ Project
    const project = await this.projectRepo.findOne({
      where: { publicId: projectId },
      select: ['id'],
    });

    if (!project) {
      throw new NotFoundException('Project', String(projectId));
    }

    // 2. ตรวจสอบสิทธิ (UserAssignment)
    // สำหรับ Global Admin อาจจะไม่ต้องเช็ค (ในที่นี้เช็คว่ามีการมอบหมายโครงการนี้ให้หรือไม่)
    // NOTE: ในอนาคตอาจจะใช้ CASL แทน
    const assignment = await this.userAssignmentRepo.findOne({
      where: { userId, projectId: project.id },
    });

    // Check if user is a global admin (assigned to NULL project/org/contract)
    const isGlobalAdmin = await this.userAssignmentRepo.findOne({
      where: {
        userId,
        projectId: undefined,
        organizationId: undefined,
        contractId: undefined,
      },
    });

    if (!assignment && !isGlobalAdmin) {
      this.logger.warn(
        `User ${userId} attempted to access project ${projectId} without assignment`
      );
      throw new PermissionException('project', 'view');
    }

    return project.id;
  }

  /**
   * ดึงสถิติ Dashboard
   * @param userId - ID ของ User ที่ Login
   */
  async getStats(userId: number, dto: GetStatsDto): Promise<DashboardStatsDto> {
    const { projectId } = dto;
    this.logger.debug(
      `Getting dashboard stats for user ${userId}, project: ${projectId || 'Global'}`
    );

    let internalProjectId: number | undefined;
    if (projectId) {
      internalProjectId = await this.checkProjectAccess(userId, projectId);
    }

    // นับจำนวนเอกสาร
    const totalDocumentsQuery = this.correspondenceRepo.createQueryBuilder('c');
    if (internalProjectId) {
      totalDocumentsQuery.where('c.projectId = :internalProjectId', {
        internalProjectId,
      });
    }
    const totalDocuments = await totalDocumentsQuery.getCount();

    // นับจำนวนเอกสารเดือนนี้
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const documentsThisMonth = await this.correspondenceRepo
      .createQueryBuilder('c')
      .where('c.createdAt >= :startOfMonth', { startOfMonth })
      .getCount();

    // นับงานที่รอ Approve (Workflow Active)
    const pendingApprovalsQuery = this.workflowInstanceRepo
      .createQueryBuilder('w')
      .where('w.status = :status', { status: WorkflowStatus.ACTIVE });

    if (internalProjectId) {
      // WorkflowInstance JOIN กับ Correspondence เพื่อเช็ค Project
      pendingApprovalsQuery
        .innerJoin('correspondences', 'c', 'w.entity_id = c.uuid')
        .andWhere('c.project_id = :internalProjectId', { internalProjectId });
    }
    const pendingApprovals = await pendingApprovalsQuery.getCount();

    // นับ RFA ทั้งหมด
    let rfaSql = `
      SELECT COUNT(*) as count
      FROM correspondences c
      JOIN correspondence_types ct ON c.correspondence_type_id = ct.id
      WHERE ct.type_code = 'RFA'
    `;
    const params: (string | number)[] = [];
    if (internalProjectId) {
      rfaSql += ` AND c.project_id = ?`;
      params.push(internalProjectId);
    }
    const rfaCountResult = await this.dataSource.query<
      { count: string | number }[]
    >(rfaSql, params);
    const totalRfas = Number(rfaCountResult[0]?.count || '0');

    // นับ Circulation ทั้งหมด
    let circSql = `SELECT COUNT(*) as count FROM circulations ci`;
    if (internalProjectId) {
      circSql += ` JOIN correspondences c ON ci.correspondence_id = c.id WHERE c.project_id = ?`;
    }
    const circulationsCountResult = await this.dataSource.query<
      { count: string | number }[]
    >(circSql, internalProjectId ? [internalProjectId] : []);
    const totalCirculations = Number(circulationsCountResult[0]?.count || '0');

    // นับเอกสารที่อนุมัติแล้ว (APPROVED)
    // NOTE: อาจจะต้องปรับ logic ตาม Business ว่า "อนุมัติ" หมายถึงอะไร
    // เบื้องต้นนับจาก CorrespondenceStatus ที่เป็น 'APPROVED' หรือ 'CODE 1'
    // หรือนับจาก Workflow ที่ Completed และ Action เป็น APPROVE
    // เพื่อความง่ายในเบื้องต้น นับจาก CorrespondenceRevision ที่มี status 'APPROVED' (ถ้ามี)

    // สำหรับ LCBP3 นับ RFA ที่ approveCodeId ไม่ใช่ null (หรือ check status code = APR/FAP)
    // และ Correspondence ทั่วไปที่มีสถานะ Completed
    // เพื่อความรวดเร็ว ใช้วิธีนับ Revision ที่ isCurrent = 1 และ statusCode = 'APR' (Approved)

    // นับเอกสารที่อนุมัติแล้ว
    let appSql = `
        SELECT COUNT(r.id) as count
        FROM correspondence_revisions r
        JOIN correspondence_status s ON r.correspondence_status_id = s.id
        JOIN correspondences c ON r.correspondence_id = c.id
        WHERE r.is_current = 1 AND s.status_code IN ('APR', 'CMP')
    `;
    if (internalProjectId) {
      appSql += ` AND c.project_id = ?`;
    }
    const aprStatusCount = await this.dataSource.query<
      { count: string | number }[]
    >(appSql, internalProjectId ? [internalProjectId] : []);
    const approved = Number(aprStatusCount[0]?.count || '0');

    return {
      totalDocuments,
      documentsThisMonth,
      pendingApprovals,
      approved,
      totalRfas,
      totalCirculations,
    };
  }

  /**
   * ดึง Activity ล่าสุด
   * @param userId - ID ของ User ที่ Login
   * @param dto - Query params
   */
  async getActivity(
    userId: number,
    dto: GetActivityDto
  ): Promise<ActivityItemDto[]> {
    const { limit = 10, projectId } = dto;
    this.logger.debug(
      `Getting recent activity for user ${userId}, project: ${projectId || 'Global'}`
    );

    let internalProjectId: number | undefined;
    if (projectId) {
      internalProjectId = await this.checkProjectAccess(userId, projectId);
    }

    // ดึง Recent Audit Logs
    const query = this.auditLogRepo
      .createQueryBuilder('log')
      .leftJoin('log.user', 'user')
      .select([
        'log.auditId',
        'log.action',
        'log.entityType',
        'log.entityId',
        'log.detailsJson',
        'log.createdAt',
        'user.username',
        'user.firstName',
        'user.lastName',
      ]);

    // NOTE: AuditLog อาจจะไม่มี projectId โดยตรง
    // ในที่นี้ถ้ามี projectId เราจะพยายามกรองจาก detailsJson หรือ Entity ล่าสุด
    // หรือถ้า Entity เป็น Correspondence เราสามารถ JOIN ได้
    // เบื้องต้นถ้าไม่ซับซ้อน จะดึง Global มาก่อน หรือถ้าโครงการสำคัญมากให้ปรับ Schema
    if (internalProjectId) {
      // ตัวอย่างการกรองเบื้องต้นสำหรับ Correspondence
      query.andWhere(
        `(log.entityType = 'Correspondence' AND CAST(JSON_EXTRACT(log.detailsJson, '$.projectId') AS UNSIGNED) = :internalProjectId)
             OR (log.entityType != 'Correspondence')`, // แสดงอย่างอื่นด้วย
        { internalProjectId }
      );
    }

    const logs = await query
      .orderBy('log.createdAt', 'DESC')
      .limit(limit)
      .getMany();

    return logs.map((log) => ({
      id: log.auditId,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      details: log.detailsJson,
      createdAt: log.createdAt,
      user: log.user
        ? {
            username: log.user.username,
            firstName: log.user.firstName,
            lastName: log.user.lastName,
          }
        : undefined,
    }));
  }

  /**
   * ดึง Pending Tasks ของ User
   * ใช้ v_user_tasks view จาก Database
   * @param userId - ID ของ User ที่ Login
   * @param dto - Query params
   */
  async getPending(
    userId: number,
    dto: GetPendingDto
  ): Promise<{
    data: PendingTaskItemDto[];
    meta: { total: number; page: number; limit: number };
  }> {
    const { page = 1, limit = 10, projectId } = dto;
    const offset = (page - 1) * limit;

    this.logger.debug(
      `Getting pending tasks for user ${userId}, project: ${projectId || 'Global'}`
    );

    let internalProjectId: number | undefined;
    if (projectId) {
      internalProjectId = await this.checkProjectAccess(userId, projectId);
    }

    const userIdNum = Number(userId);

    const joinClause = internalProjectId
      ? `JOIN correspondence_revisions cr ON v_user_tasks.entity_id = CAST(cr.id AS CHAR) AND v_user_tasks.entity_type IN ('rfa_revision', 'correspondence_revision')
         JOIN correspondences c ON cr.correspondence_id = c.id
         LEFT JOIN circulations circ ON v_user_tasks.entity_id = CAST(circ.id AS CHAR) AND v_user_tasks.entity_type = 'circulation'
         LEFT JOIN correspondences c2 ON circ.correspondence_id = c2.id`
      : '';
    const projectFilter = internalProjectId
      ? `AND (c.project_id = ? OR c2.project_id = ?)`
      : '';

    const [tasks, countResult] = await Promise.all([
      this.dataSource.query<PendingTaskItemDto[]>(
        `
        SELECT
          v_user_tasks.instance_id as instanceId,
          v_user_tasks.workflow_code as workflowCode,
          v_user_tasks.current_state as currentState,
          v_user_tasks.entity_type as entityType,
          v_user_tasks.entity_id as entityId,
          v_user_tasks.document_number as documentNumber,
          v_user_tasks.subject,
          v_user_tasks.assigned_at as assignedAt
        FROM v_user_tasks
        ${joinClause}
        WHERE
          (JSON_SEARCH(v_user_tasks.assignee_ids_json, 'one', ?) IS NOT NULL OR v_user_tasks.owner_id = ?)
          ${projectFilter}
        ORDER BY v_user_tasks.assigned_at DESC
        LIMIT ? OFFSET ?
      `,
        internalProjectId
          ? [
              userIdNum,
              userIdNum,
              internalProjectId,
              internalProjectId,
              limit,
              offset,
            ]
          : [userIdNum, userIdNum, limit, offset]
      ),
      this.dataSource.query<{ total: string | number }[]>(
        `
        SELECT COUNT(v_user_tasks.instance_id) as total
        FROM v_user_tasks
        ${joinClause}
        WHERE
          (JSON_SEARCH(v_user_tasks.assignee_ids_json, 'one', ?) IS NOT NULL OR v_user_tasks.owner_id = ?)
          ${projectFilter}
      `,
        internalProjectId
          ? [userIdNum, userIdNum, internalProjectId, internalProjectId]
          : [userIdNum, userIdNum]
      ),
    ]);

    const total = Number(countResult[0]?.total || '0');

    return {
      data: tasks,
      meta: { total, page, limit },
    };
  }
}
