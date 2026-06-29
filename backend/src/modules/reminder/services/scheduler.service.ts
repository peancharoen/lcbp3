// File: src/modules/reminder/services/scheduler.service.ts
// Schedule reminders เมื่อ RFA submit (FR-013) — เพิ่ม jobs เข้า BullMQ queue
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_REMINDERS } from '../../common/constants/queue.constants';
import type { Job } from 'bullmq';
import { ReminderType } from '../../common/enums/review.enums';
import { ReminderRule } from '../entities/reminder-rule.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

export interface ScheduleReminderPayload {
  taskPublicId: string;
  rfaPublicId: string;
  assigneeUserId: number;
  dueDate: Date;
  reminderType: ReminderType;
  projectId?: number;
  documentTypeCode?: string;
}

type ReminderJob = Job<ScheduleReminderPayload>;

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectQueue(QUEUE_REMINDERS)
    private readonly reminderQueue: Queue,
    @InjectRepository(ReminderRule)
    private readonly ruleRepo: Repository<ReminderRule>
  ) {}

  /**
   * Schedule ชุด reminders ให้ Review Task (FR-013) ตาม ReminderRule
   * เรียกหลังจาก TaskCreationService สร้าง tasks เรียบร้อยแล้ว
   */
  async scheduleForTask(payload: ScheduleReminderPayload): Promise<void> {
    const { taskPublicId, dueDate, projectId, documentTypeCode } = payload;
    const now = Date.now();

    // ดึงกฎที่เกี่ยวข้อง (Global + Project specific)
    const rules = await this.ruleRepo.find({
      where: [
        { projectId, documentTypeCode, isActive: true },
        { projectId: undefined, documentTypeCode, isActive: true },
        { projectId, documentTypeCode: undefined, isActive: true },
        { projectId: undefined, documentTypeCode: undefined, isActive: true },
      ],
    });

    if (rules.length === 0) {
      this.logger.debug(`No reminder rules found for task ${taskPublicId}`);
      return;
    }

    const jobs = [];

    for (const rule of rules) {
      const triggerTime =
        dueDate.getTime() - rule.daysBeforeDue * 24 * 60 * 60 * 1000;
      const delayMs = triggerTime - now;

      // ถ้าเวลาผ่านไปแล้ว ไม่ต้อง schedule (ยกเว้น overdue ที่อาจจะต้องการส่งทันที)
      if (delayMs <= 0 && rule.reminderType !== ReminderType.OVERDUE) {
        continue;
      }

      jobs.push(
        this.reminderQueue.add(
          'send-reminder',
          {
            ...payload,
            reminderType: rule.reminderType,
          },
          {
            delay: Math.max(delayMs, 0),
            removeOnComplete: true,
            removeOnFail: 100,
            jobId: `${taskPublicId}-${rule.reminderType}-${rule.id}`, // ป้องกัน duplicate
          }
        )
      );
    }

    await Promise.all(jobs);

    this.logger.log(
      `Scheduled ${jobs.length} reminders for task ${taskPublicId} based on ${rules.length} rules`
    );
  }

  /**
   * ยกเลิก reminders ทั้งหมดของ task (เมื่อ task complete หรือ cancelled)
   */
  async cancelForTask(taskPublicId: string): Promise<void> {
    const jobs = await this.reminderQueue.getDelayed();
    const taskJobs = jobs.filter(
      (j: ReminderJob) => j.data.taskPublicId === taskPublicId
    );

    await Promise.all(taskJobs.map((j: ReminderJob) => j.remove()));

    this.logger.log(
      `Cancelled ${taskJobs.length} reminder jobs for task ${taskPublicId}`
    );
  }
}
