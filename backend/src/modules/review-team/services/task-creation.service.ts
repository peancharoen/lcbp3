// File: src/modules/review-team/services/task-creation.service.ts
// Strangler Pattern: แยก logic การสร้าง Parallel Review Tasks ออกจาก rfa.service.ts
// เรียกใช้หลังจาก RFA Submit สำเร็จ (T017 integration)

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { ReviewTeam } from '../entities/review-team.entity';
import { ReviewTeamMember } from '../entities/review-team-member.entity';
import { ReviewTask } from '../entities/review-task.entity';
import {
  ReviewTaskStatus,
  ReviewTeamMemberRole,
  DelegationScope,
  ReminderType,
} from '../../common/enums/review.enums';
import { DelegationService } from '../../delegation/delegation.service';
import { SchedulerService } from '../../reminder/services/scheduler.service';

@Injectable()
export class TaskCreationService {
  private readonly logger = new Logger(TaskCreationService.name);

  constructor(
    @InjectRepository(ReviewTeam)
    private readonly reviewTeamRepo: Repository<ReviewTeam>,
    @InjectRepository(ReviewTeamMember)
    private readonly memberRepo: Repository<ReviewTeamMember>,
    @InjectRepository(ReviewTask)
    private readonly reviewTaskRepo: Repository<ReviewTask>,
    private readonly delegationService: DelegationService,
    private readonly schedulerService: SchedulerService
  ) {}

  /**
   * สร้าง Parallel Review Tasks สำหรับแต่ละ Discipline ใน Review Team (FR-003)
   * เรียกใช้ภายใน Transaction ของ rfa.service.ts submit method
   *
   * @param rfaRevisionId - Internal ID ของ RFA Revision
   * @param reviewTeamPublicId - publicId ของ Review Team (ADR-019)
   * @param dueDate - กำหนดเวลาตรวจสอบ
   * @param manager - EntityManager จาก QueryRunner (ใช้ Transaction เดิม)
   * @param projectId - (Optional) ID ของโครงการ สำหรับ reminder rules
   * @param documentTypeCode - (Optional) ประเภทเอกสาร สำหรับ reminder rules
   */
  async createParallelTasks(
    rfaRevisionId: number,
    reviewTeamPublicId: string,
    dueDate: Date,
    manager: EntityManager,
    projectId?: number,
    documentTypeCode?: string
  ): Promise<ReviewTask[]> {
    // ดึง ReviewTeam พร้อม members
    const team = await this.reviewTeamRepo.findOne({
      where: { publicId: reviewTeamPublicId },
      relations: ['members'],
    });

    if (!team || !team.isActive) {
      this.logger.warn(
        `ReviewTeam ${reviewTeamPublicId} not found or inactive — skipping task creation`
      );
      return [];
    }

    const members = team.members ?? [];

    if (members.length === 0) {
      this.logger.warn(
        `ReviewTeam ${reviewTeamPublicId} has no members — skipping task creation`
      );
      return [];
    }

    // กลุ่ม members ตาม disciplineId (แต่ละ Discipline ต้องการเพียง 1 Task)
    const disciplineMap = new Map<number, ReviewTeamMember>();
    for (const member of members) {
      // LEAD มี priority สูงสุด ถ้ามีหลายคนใน Discipline เดียวกัน
      const existing = disciplineMap.get(member.disciplineId);
      if (!existing || member.role === ReviewTeamMemberRole.LEAD) {
        disciplineMap.set(member.disciplineId, member);
      }
    }

    const tasks: ReviewTask[] = [];

    // สร้าง ReviewTask สำหรับแต่ละ Discipline พร้อมกัน (Parallel)
    for (const [disciplineId, leadMember] of disciplineMap) {
      const activeDelegate = await this.delegationService.findActiveDelegate(
        leadMember.userId,
        dueDate,
        [DelegationScope.ALL, DelegationScope.RFA_ONLY]
      );
      const assignedToUserId = activeDelegate?.user_id ?? leadMember.userId;
      const delegatedFromUserId = activeDelegate
        ? leadMember.userId
        : undefined;

      const task = manager.create(ReviewTask, {
        rfaRevisionId,
        teamId: team.id,
        disciplineId,
        assignedToUserId,
        delegatedFromUserId,
        status: ReviewTaskStatus.PENDING,
        dueDate,
      });
      const saved = await manager.save(ReviewTask, task);
      tasks.push(saved);

      // Schedule Reminders & Escalation (US4)
      if (saved.assignedToUserId) {
        await this.schedulerService.scheduleForTask({
          taskPublicId: saved.publicId,
          rfaPublicId: rfaRevisionId.toString(), // ใช้ rfaRevisionId เป็น placeholder
          assigneeUserId: saved.assignedToUserId,
          dueDate: saved.dueDate ?? dueDate,
          reminderType: ReminderType.DUE_SOON, // Start type, scheduler will fetch rules
          projectId: projectId ?? team.projectId,
          documentTypeCode,
        });
      }
    }

    this.logger.log(
      `Created ${tasks.length} parallel review tasks for RFA revision ${rfaRevisionId}, team ${reviewTeamPublicId}`
    );

    return tasks;
  }

  /**
   * ตรวจสอบว่า RFA Revision มี Review Tasks ครบทุก Discipline แล้วหรือยัง
   */
  async areAllTasksCompleted(rfaRevisionId: number): Promise<boolean> {
    const tasks = await this.reviewTaskRepo.find({
      where: { rfaRevisionId },
    });

    if (tasks.length === 0) return false;

    return tasks.every(
      (t: ReviewTask) =>
        t.status === ReviewTaskStatus.COMPLETED ||
        t.status === ReviewTaskStatus.CANCELLED
    );
  }
}
