// File: src/modules/reminder/services/escalation.service.ts
// 2-Level Escalation เมื่อ Review Task เกิน due date (FR-015)
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ReviewTask } from '../../review-team/entities/review-task.entity';
import {
  ReviewTaskStatus,
  ReminderType,
} from '../../common/enums/review.enums';
import { NotificationService } from '../../notification/notification.service';
import { ReminderRule } from '../entities/reminder-rule.entity';
import { ReminderHistory } from '../entities/reminder-history.entity';
import { UserAssignment } from '../../user/entities/user-assignment.entity';
import { CorrespondenceRevision } from '../../correspondence/entities/correspondence-revision.entity';

@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(
    @InjectRepository(ReviewTask)
    private readonly reviewTaskRepo: Repository<ReviewTask>,
    @InjectRepository(ReminderRule)
    private readonly reminderRuleRepo: Repository<ReminderRule>,
    @InjectRepository(ReminderHistory)
    private readonly historyRepo: Repository<ReminderHistory>,
    @InjectRepository(UserAssignment)
    private readonly assignmentRepo: Repository<UserAssignment>,
    private readonly notificationService: NotificationService
  ) {}

  /**
   * บันทึกประวัติการส่ง reminder (FR-018)
   */
  async recordHistory(
    task: ReviewTask,
    type: ReminderType,
    level: number
  ): Promise<void> {
    const history = this.historyRepo.create({
      taskId: task.id,
      userId: task.assignedToUserId,
      reminderType: type,
      escalationLevel: level,
    });
    await this.historyRepo.save(history);
  }

  /**
   * นับจำนวนครั้งที่ส่ง reminder สำหรับ level นั้นๆ
   */
  async getStrikeCount(taskId: number, level: number): Promise<number> {
    return this.historyRepo.count({
      where: { taskId, escalationLevel: level },
    });
  }

  /**
   * Escalation Level 1 (FR-015): Team Lead ได้รับแจ้งเตือน
   * เรียกเมื่อ task เกิน due date
   */
  async escalateLevel1(taskPublicId: string): Promise<void> {
    const task = await this.reviewTaskRepo.findOne({
      where: { publicId: taskPublicId },
      relations: ['team', 'assignedToUser', 'discipline'],
    });

    if (!task || task.status === ReviewTaskStatus.COMPLETED) return;

    const strikes = await this.getStrikeCount(task.id, 1);
    if (strikes >= 3) {
      this.logger.log(
        `Task ${taskPublicId} L1 strikes reached 3 — moving to L2`
      );
      await this.escalateLevel2(taskPublicId);
      return;
    }

    this.logger.log(
      `Escalation L1 (Strike ${strikes + 1}): task ${taskPublicId}`
    );

    if (task.assignedToUserId) {
      await this.notificationService.send({
        userId: task.assignedToUserId,
        title: `⚠ Review Task Overdue (L1 Strike ${strikes + 1})`,
        message: `Your review task is overdue. Please complete it immediately.`,
        type: 'SYSTEM',
        entityType: 'review_task',
        entityId: task.id,
      });
      await this.recordHistory(task, ReminderType.ESCALATION_L1, 1);
    }
  }

  /**
   * Escalation Level 2 (FR-016): Project Manager ได้รับแจ้งเตือน
   * เรียกเมื่อ L1 ครบ 3 ครั้ง หรือตามเงื่อนไข SLA
   */
  async escalateLevel2(taskPublicId: string): Promise<void> {
    const task = await this.reviewTaskRepo.findOne({
      where: { publicId: taskPublicId },
      relations: ['team', 'assignedToUser'],
    });

    if (!task || task.status === ReviewTaskStatus.COMPLETED) return;

    const strikes = await this.getStrikeCount(task.id, 2);

    this.logger.warn(
      `Escalation L2 (Strike ${strikes + 1}): task ${taskPublicId} — escalating to PM`
    );

    // ✅ [Fix] ดึง PM user ID จาก project membership (T068.5)
    let pmUserId: number | undefined = undefined;

    try {
      const fullTask = (await this.reviewTaskRepo.findOne({
        where: { publicId: taskPublicId },
        relations: [
          'rfaRevision',
          'rfaRevision.correspondenceRevision',
          'rfaRevision.correspondenceRevision.correspondence',
        ],
      })) as {
        rfaRevision?: {
          correspondenceRevision?: CorrespondenceRevision;
        };
      } | null;

      const correspondence =
        fullTask?.rfaRevision?.correspondenceRevision?.correspondence;

      if (correspondence?.projectId) {
        const pmAssignment = await this.assignmentRepo.findOne({
          where: {
            projectId: correspondence.projectId,
            role: { roleName: 'Project Manager' },
          },
          relations: ['role'],
        });
        pmUserId = pmAssignment?.userId;
      }
    } catch (err: unknown) {
      this.logger.error(
        `Failed to find PM for task ${taskPublicId}: ${String(err)}`
      );
    }

    // แจ้ง PM (ถ้าหาเจอ)
    if (pmUserId) {
      await this.notificationService.send({
        userId: pmUserId,
        title: `🛑 ESCALATION L2: Review Task Overdue`,
        message: `Task ${task.publicId} (${task.discipline?.codeNameEn ?? ''}) assigned to ${task.assignedToUser?.firstName ?? ''} ${task.assignedToUser?.lastName ?? ''} is critically overdue.`,
        type: 'SYSTEM',
        entityType: 'review_task',
        entityId: task.id,
      });
    }

    // แจ้งผู้รับผิดชอบเดิมด้วย
    if (task.assignedToUserId) {
      await this.notificationService.send({
        userId: task.assignedToUserId,
        title: `🛑 CRITICAL: Review Task Overdue (L2 Strike ${strikes + 1})`,
        message: `Your review task is critically overdue. Project Management has been notified.`,
        type: 'SYSTEM',
        entityType: 'review_task',
        entityId: task.id,
      });
      await this.recordHistory(task, ReminderType.ESCALATION_L2, 2);
    }
  }

  /**
   * สแกน tasks ที่ overdue ทั้งหมด และ escalate ตาม level (cron trigger)
   */
  async processOverdueTasks(): Promise<void> {
    const now = new Date();

    const overdueTasks = await this.reviewTaskRepo.find({
      where: {
        status: ReviewTaskStatus.IN_PROGRESS,
        dueDate: LessThan(now),
      },
      select: ['publicId', 'dueDate'],
    });

    this.logger.log(`Processing ${overdueTasks.length} overdue tasks`);

    for (const task of overdueTasks) {
      // ดึง history ล่าสุดเพื่อดูว่าควร escalate level ไหน
      const lastHistory = await this.historyRepo.findOne({
        where: { taskId: task.id },
        order: { sentAt: 'DESC' },
      });

      if (!lastHistory || lastHistory.escalationLevel === 0) {
        await this.escalateLevel1(task.publicId);
      } else if (lastHistory.escalationLevel === 1) {
        const strikes = await this.getStrikeCount(task.id, 1);
        if (strikes >= 3) {
          await this.escalateLevel2(task.publicId);
        } else {
          await this.escalateLevel1(task.publicId); // FIXED typo
        }
      } else if (lastHistory.escalationLevel === 2) {
        await this.escalateLevel2(task.publicId); // Daily reminder for L2
      }
    }
  }
}
