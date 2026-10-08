// File: backend/src/modules/reminder/processors/reminder.processor.ts
// Change Log:
// - 2026-10-06: User Grouping Model — fan-out ตาม rule.recipients ผ่าน RecipientResolverService (fallback = assignee เดิม)
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QUEUE_REMINDERS } from '../../common/constants/queue.constants';
import { ReminderType } from '../../common/enums/review.enums';
import { EscalationService } from '../services/escalation.service';
import { RecipientResolverService } from '../services/recipient-resolver.service';
import { NotificationService } from '../../notification/notification.service';
import { ScheduleReminderPayload } from '../services/scheduler.service';
import { ReviewTask } from '../../review-team/entities/review-task.entity';
import { ReminderRule } from '../entities/reminder-rule.entity';

@Processor(QUEUE_REMINDERS)
export class ReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(ReminderProcessor.name);

  constructor(
    private readonly escalationService: EscalationService,
    private readonly recipientResolver: RecipientResolverService,
    private readonly notificationService: NotificationService,
    @InjectRepository(ReviewTask)
    private readonly taskRepo: Repository<ReviewTask>,
    @InjectRepository(ReminderRule)
    private readonly ruleRepo: Repository<ReminderRule>
  ) {
    super();
  }

  async process(job: Job<ScheduleReminderPayload>): Promise<void> {
    const { taskPublicId, assigneeUserId, reminderType, ruleId } = job.data;

    this.logger.log(
      `Processing reminder job: ${reminderType} for task ${taskPublicId}`
    );

    // ดึง internal ID ของ task (รวม teamId สำหรับ resolve symbolic recipients)
    const task = await this.taskRepo.findOne({
      where: { publicId: taskPublicId },
      select: ['id', 'assignedToUserId', 'teamId'],
    });

    if (!task) {
      this.logger.warn(`Task ${taskPublicId} not found — skipping reminder`);
      return;
    }

    switch (reminderType) {
      case ReminderType.DUE_SOON:
        await this.sendToRecipients(
          task,
          ruleId,
          assigneeUserId,
          '⏰ Review Task Due Soon',
          'Your review task is due soon. Please complete your review.'
        );
        await this.escalationService.recordHistory(task, reminderType, 0);
        break;

      case ReminderType.ON_DUE:
        await this.sendToRecipients(
          task,
          ruleId,
          assigneeUserId,
          '🔔 Review Task Due Today',
          'Your review task is due today. Please complete it as soon as possible.'
        );
        await this.escalationService.recordHistory(task, reminderType, 0);
        break;

      case ReminderType.OVERDUE:
        await this.sendToRecipients(
          task,
          ruleId,
          assigneeUserId,
          '🚨 Review Task Overdue',
          'Your review task is overdue. Escalation will occur if not completed.'
        );
        await this.escalationService.recordHistory(task, reminderType, 0);
        break;

      case ReminderType.ESCALATION_L1:
        await this.escalationService.escalateLevel1(taskPublicId);
        break;

      case ReminderType.ESCALATION_L2:
        await this.escalationService.escalateLevel2(taskPublicId);
        break;

      default:
        this.logger.warn(`Unknown reminder type: ${reminderType as string}`);
    }
  }

  /**
   * ส่ง notification ให้ recipients ของ rule (resolve ตอน process — membership อาจเปลี่ยนหลัง schedule)
   * ถ้า rule ไม่มี recipients หรือ resolve ไม่ได้เลย → fallback ส่งหา assignee เหมือนเดิม
   */
  private async sendToRecipients(
    task: ReviewTask,
    ruleId: number | undefined,
    fallbackUserId: number,
    title: string,
    message: string
  ): Promise<void> {
    let targetUserIds: number[] = [];

    if (ruleId) {
      const rule = await this.ruleRepo.findOne({
        where: { id: ruleId },
        relations: ['recipients'],
      });
      if (rule?.recipients?.length) {
        targetUserIds = await this.recipientResolver.resolve(
          rule.recipients,
          task
        );
      }
    }

    if (targetUserIds.length === 0) {
      targetUserIds = [fallbackUserId];
    }

    for (const userId of targetUserIds) {
      await this.notificationService.send({
        userId,
        title,
        message,
        type: 'SYSTEM',
        alsoTelegram: true,
        eventType: 'sla.deadline_reminder',
        entityType: 'review_task',
        entityId: task.id,
      });
    }
  }
}
