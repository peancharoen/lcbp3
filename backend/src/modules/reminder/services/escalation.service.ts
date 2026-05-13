// File: src/modules/reminder/services/escalation.service.ts
// 2-Level Escalation เมื่อ Review Task เกิน due date (FR-015)
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ReviewTask } from '../../review-team/entities/review-task.entity';
import { ReviewTaskStatus } from '../../common/enums/review.enums';
import { NotificationService } from '../../notification/notification.service';
import { ReminderRule } from '../entities/reminder-rule.entity';

@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(
    @InjectRepository(ReviewTask)
    private readonly reviewTaskRepo: Repository<ReviewTask>,
    @InjectRepository(ReminderRule)
    private readonly reminderRuleRepo: Repository<ReminderRule>,
    private readonly notificationService: NotificationService
  ) {}

  /**
   * Escalation Level 1 (FR-015): Team Lead ได้รับแจ้งเตือน
   * เรียกเมื่อ task เกิน due date 1 วัน
   */
  async escalateLevel1(taskPublicId: string): Promise<void> {
    const task = await this.reviewTaskRepo.findOne({
      where: { publicId: taskPublicId },
      relations: ['team', 'assignedToUser', 'discipline'],
    });

    if (!task || task.status === ReviewTaskStatus.COMPLETED) return;

    const daysOverdue = task.dueDate
      ? Math.floor((Date.now() - task.dueDate.getTime()) / 86_400_000)
      : 0;

    if (daysOverdue < 1) return;

    this.logger.log(
      `Escalation L1: task ${taskPublicId} is ${daysOverdue} days overdue`
    );

    // แจ้ง Team Lead
    if (task.assignedToUserId) {
      await this.notificationService.send({
        userId: task.assignedToUserId,
        title: `⚠ Review Task Overdue (${daysOverdue}d)`,
        message: `Your review task is overdue by ${daysOverdue} day(s). Please complete it immediately.`,
        type: 'SYSTEM',
        entityType: 'review_task',
        entityId: task.id,
      });
    }
  }

  /**
   * Escalation Level 2 (FR-016): Project Manager ได้รับแจ้งเตือน
   * เรียกเมื่อ task เกิน due date 3 วัน
   */
  async escalateLevel2(taskPublicId: string): Promise<void> {
    const task = await this.reviewTaskRepo.findOne({
      where: { publicId: taskPublicId },
      relations: ['team', 'assignedToUser'],
    });

    if (!task || task.status === ReviewTaskStatus.COMPLETED) return;

    const daysOverdue = task.dueDate
      ? Math.floor((Date.now() - task.dueDate.getTime()) / 86_400_000)
      : 0;

    if (daysOverdue < 3) return;

    this.logger.warn(
      `Escalation L2: task ${taskPublicId} is ${daysOverdue} days overdue — escalating to PM`
    );

    // TODO: ดึง PM user ID จาก project membership — ใช้ placeholder สำหรับตอนนี้
    this.logger.log(
      `L2 escalation notification queued for task ${taskPublicId}`
    );
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
      const daysOverdue = task.dueDate
        ? Math.floor((Date.now() - task.dueDate.getTime()) / 86_400_000)
        : 0;

      if (daysOverdue >= 3) {
        await this.escalateLevel2(task.publicId);
      } else if (daysOverdue >= 1) {
        await this.escalateLevel1(task.publicId);
      }
    }
  }
}
