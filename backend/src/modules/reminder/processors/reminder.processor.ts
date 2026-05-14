// File: src/modules/reminder/processors/reminder.processor.ts
// BullMQ Worker สำหรับประมวลผล Reminder jobs (ADR-008)
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QUEUE_REMINDERS } from '../../common/constants/queue.constants';
import { ReminderType } from '../../common/enums/review.enums';
import { EscalationService } from '../services/escalation.service';
import { NotificationService } from '../../notification/notification.service';
import { ScheduleReminderPayload } from '../services/scheduler.service';
import { ReviewTask } from '../../review-team/entities/review-task.entity';

@Processor(QUEUE_REMINDERS)
export class ReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(ReminderProcessor.name);

  constructor(
    private readonly escalationService: EscalationService,
    private readonly notificationService: NotificationService,
    @InjectRepository(ReviewTask)
    private readonly taskRepo: Repository<ReviewTask>
  ) {
    super();
  }

  async process(job: Job<ScheduleReminderPayload>): Promise<void> {
    const { taskPublicId, assigneeUserId, reminderType } = job.data;

    this.logger.log(
      `Processing reminder job: ${reminderType} for task ${taskPublicId}`
    );

    // ดึง internal ID ของ task
    const task = await this.taskRepo.findOne({
      where: { publicId: taskPublicId },
      select: ['id', 'assignedToUserId'],
    });

    if (!task) {
      this.logger.warn(`Task ${taskPublicId} not found — skipping reminder`);
      return;
    }

    switch (reminderType) {
      case ReminderType.DUE_SOON:
        await this.notificationService.send({
          userId: assigneeUserId,
          title: '⏰ Review Task Due Soon',
          message: 'Your review task is due soon. Please complete your review.',
          type: 'SYSTEM',
          entityType: 'review_task',
          entityId: task.id,
        });
        await this.escalationService.recordHistory(task, reminderType, 0);
        break;

      case ReminderType.ON_DUE:
        await this.notificationService.send({
          userId: assigneeUserId,
          title: '🔔 Review Task Due Today',
          message:
            'Your review task is due today. Please complete it as soon as possible.',
          type: 'SYSTEM',
          entityType: 'review_task',
          entityId: task.id,
        });
        await this.escalationService.recordHistory(task, reminderType, 0);
        break;

      case ReminderType.OVERDUE:
        await this.notificationService.send({
          userId: assigneeUserId,
          title: '🚨 Review Task Overdue',
          message:
            'Your review task is overdue. Escalation will occur if not completed.',
          type: 'SYSTEM',
          entityType: 'review_task',
          entityId: task.id,
        });
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
}
