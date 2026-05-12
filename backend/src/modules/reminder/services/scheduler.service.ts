// File: src/modules/reminder/services/scheduler.service.ts
// Schedule reminders เมื่อ RFA submit (FR-013) — เพิ่ม jobs เข้า BullMQ queue
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_REMINDERS } from '../../common/constants/queue.constants';
import type { Job } from 'bullmq';
import { ReminderType } from '../../common/enums/review.enums';

export interface ScheduleReminderPayload {
  taskPublicId: string;
  rfaPublicId: string;
  assigneeUserId: number;
  dueDate: Date;
  reminderType: ReminderType;
}

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectQueue(QUEUE_REMINDERS)
    private readonly reminderQueue: Queue,
  ) {}

  /**
   * Schedule ชุด reminders ให้ Review Task (FR-013)
   * เรียกหลังจาก TaskCreationService สร้าง tasks เรียบร้อยแล้ว
   */
  async scheduleForTask(payload: ScheduleReminderPayload): Promise<void> {
    const { taskPublicId, dueDate } = payload;
    const now = Date.now();

    const remindersToSchedule: Array<{ type: ReminderType; delayMs: number }> = [];

    // 2 วันก่อน due date
    const twoDaysBefore = dueDate.getTime() - 2 * 86_400_000;
    if (twoDaysBefore > now) {
      remindersToSchedule.push({
        type: ReminderType.DUE_SOON,
        delayMs: twoDaysBefore - now,
      });
    }

    // วัน due date เอง
    const onDue = dueDate.getTime();
    if (onDue > now) {
      remindersToSchedule.push({
        type: ReminderType.ON_DUE,
        delayMs: onDue - now,
      });
    }

    // 1 วันหลัง due (Escalation L1)
    const oneDayAfter = dueDate.getTime() + 1 * 86_400_000;
    remindersToSchedule.push({
      type: ReminderType.ESCALATION_L1,
      delayMs: Math.max(oneDayAfter - now, 0),
    });

    // 3 วันหลัง due (Escalation L2)
    const threeDaysAfter = dueDate.getTime() + 3 * 86_400_000;
    remindersToSchedule.push({
      type: ReminderType.ESCALATION_L2,
      delayMs: Math.max(threeDaysAfter - now, 0),
    });

    await Promise.all(
      remindersToSchedule.map(({ type, delayMs }) =>
        this.reminderQueue.add(
          'send-reminder',
          { ...payload, reminderType: type },
          { delay: delayMs, removeOnComplete: true, removeOnFail: 100 },
        ),
      ),
    );

    this.logger.log(
      `Scheduled ${remindersToSchedule.length} reminders for task ${taskPublicId}`,
    );
  }

  /**
   * ยกเลิก reminders ทั้งหมดของ task (เมื่อ task complete หรือ cancelled)
   */
  async cancelForTask(taskPublicId: string): Promise<void> {
    const jobs = await this.reminderQueue.getDelayed();
    const taskJobs = jobs.filter((j: Job) => j.data?.taskPublicId === taskPublicId);

    await Promise.all(taskJobs.map((j: Job) => j.remove()));

    this.logger.log(
      `Cancelled ${taskJobs.length} reminder jobs for task ${taskPublicId}`,
    );
  }
}
