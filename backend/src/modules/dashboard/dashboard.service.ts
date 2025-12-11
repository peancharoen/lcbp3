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
} from './dto';

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
    private dataSource: DataSource
  ) {}

  /**
   * ดึงสถิติ Dashboard
   * @param userId - ID ของ User ที่ Login
   */
  async getStats(userId: number): Promise<DashboardStatsDto> {
    this.logger.debug(`Getting dashboard stats for user ${userId}`);

    // นับจำนวนเอกสารทั้งหมด
    const totalDocuments = await this.correspondenceRepo.count();

    // นับจำนวนเอกสารเดือนนี้
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const documentsThisMonth = await this.correspondenceRepo
      .createQueryBuilder('c')
      .where('c.createdAt >= :startOfMonth', { startOfMonth })
      .getCount();

    // นับงานที่รอ Approve (Workflow Active)
    const pendingApprovals = await this.workflowInstanceRepo.count({
      where: { status: WorkflowStatus.ACTIVE },
    });

    // นับ RFA ทั้งหมด (correspondence_type_id = RFA type)
    // ใช้ Raw Query เพราะต้อง JOIN กับ correspondence_types
    const rfaCountResult = await this.dataSource.query(`
      SELECT COUNT(*) as count
      FROM correspondences c
      JOIN correspondence_types ct ON c.correspondence_type_id = ct.id
      WHERE ct.type_code = 'RFA'
    `);
    const totalRfas = parseInt(rfaCountResult[0]?.count || '0', 10);

    // นับ Circulation ทั้งหมด
    const circulationsCountResult = await this.dataSource.query(`
      SELECT COUNT(*) as count FROM circulations
    `);
    const totalCirculations = parseInt(
      circulationsCountResult[0]?.count || '0',
      10
    );

    // นับเอกสารที่อนุมัติแล้ว (APPROVED)
    // NOTE: อาจจะต้องปรับ logic ตาม Business ว่า "อนุมัติ" หมายถึงอะไร
    // เบื้องต้นนับจาก CorrespondenceStatus ที่เป็น 'APPROVED' หรือ 'CODE 1'
    // หรือนับจาก Workflow ที่ Completed และ Action เป็น APPROVE
    // เพื่อความง่ายในเบื้องต้น นับจาก CorrespondenceRevision ที่มี status 'APPROVED' (ถ้ามี)
    // หรือนับจาก RFA ที่มี Approve Code

    // สำหรับ LCBP3 นับ RFA ที่ approveCodeId ไม่ใช่ null (หรือ check status code = APR/FAP)
    // และ Correspondence ทั่วไปที่มีสถานะ Completed
    // เพื่อความรวดเร็ว ใช้วิธีนับ Revision ที่ isCurrent = 1 และ statusCode = 'APR' (Approved)

    // Check status code 'APR' exists
    const aprStatusCount = await this.dataSource.query(`
        SELECT COUNT(r.id) as count
        FROM correspondence_revisions r
        JOIN correspondence_status s ON r.correspondence_status_id = s.id
        WHERE r.is_current = 1 AND s.status_code IN ('APR', 'CMP')
    `);
    const approved = parseInt(aprStatusCount[0]?.count || '0', 10);

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
    const { limit = 10 } = dto;
    this.logger.debug(`Getting recent activity for user ${userId}`);

    // ดึง Recent Audit Logs
    const logs = await this.auditLogRepo
      .createQueryBuilder('log')
      .leftJoin('log.user', 'user')
      .select([
        'log.action',
        'log.entityType',
        'log.entityId',
        'log.detailsJson',
        'log.createdAt',
        'user.username',
      ])
      .orderBy('log.createdAt', 'DESC')
      .limit(limit)
      .getMany();

    return logs.map((log) => ({
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      details: log.detailsJson,
      createdAt: log.createdAt,
      username: log.user?.username,
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
    const { page = 1, limit = 10 } = dto;
    const offset = (page - 1) * limit;

    this.logger.debug(`Getting pending tasks for user ${userId}`);

    // ใช้ Raw Query เพราะต้อง Query จาก View และ Filter ด้วย JSON
    // v_user_tasks มี assignee_ids_json สำหรับ Filter
    // MariaDB 11.8: ใช้ JSON_SEARCH แทน CAST AS JSON
    const userIdNum = Number(userId);

    const [tasks, countResult] = await Promise.all([
      this.dataSource.query(
        `
        SELECT
          instance_id as instanceId,
          workflow_code as workflowCode,
          current_state as currentState,
          entity_type as entityType,
          entity_id as entityId,
          document_number as documentNumber,
          subject,
          assigned_at as assignedAt
        FROM v_user_tasks
        WHERE
          JSON_SEARCH(assignee_ids_json, 'one', ?) IS NOT NULL
          OR owner_id = ?
        ORDER BY assigned_at DESC
        LIMIT ? OFFSET ?
      `,
        [userIdNum, userIdNum, limit, offset]
      ),
      this.dataSource.query(
        `
        SELECT COUNT(*) as total
        FROM v_user_tasks
        WHERE
          JSON_SEARCH(assignee_ids_json, 'one', ?) IS NOT NULL
          OR owner_id = ?
      `,
        [userIdNum, userIdNum]
      ),
    ]);

    const total = parseInt(countResult[0]?.total || '0', 10);

    return {
      data: tasks,
      meta: { total, page, limit },
    };
  }
}
