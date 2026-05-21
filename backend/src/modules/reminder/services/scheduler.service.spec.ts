// File: src/modules/reminder/services/scheduler.service.spec.ts
// Change Log:
// - 2026-05-21: เพิ่ม unit tests สำหรับ SchedulerService (FR-013)

/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { SchedulerService, ScheduleReminderPayload } from './scheduler.service';
import { ReminderRule } from '../entities/reminder-rule.entity';
import { QUEUE_REMINDERS } from '../../common/constants/queue.constants';
import { ReminderType } from '../../common/enums/review.enums';

// Helper สร้าง mock Job
const makeJob = (taskPublicId: string) => ({
  data: { taskPublicId },
  remove: jest.fn().mockResolvedValue(undefined),
});

// Helper สร้าง payload
const makePayload = (daysUntilDue = 5): ScheduleReminderPayload => {
  const dueDate = new Date(Date.now() + daysUntilDue * 24 * 60 * 60 * 1000);
  return {
    taskPublicId: 'task-001',
    rfaPublicId: 'rfa-001',
    assigneeUserId: 10,
    dueDate,
    reminderType: ReminderType.DUE_SOON,
    projectId: 1,
    documentTypeCode: 'SHOP_DRAWING',
  };
};

describe('SchedulerService', () => {
  let service: SchedulerService;
  const mockReminderQueue = {
    add: jest.fn().mockResolvedValue({}),
    getDelayed: jest.fn().mockResolvedValue([]),
  };
  const mockRuleRepo = { find: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        {
          provide: getQueueToken(QUEUE_REMINDERS),
          useValue: mockReminderQueue,
        },
        {
          provide: getRepositoryToken(ReminderRule),
          useValue: mockRuleRepo,
        },
      ],
    }).compile();
    service = module.get<SchedulerService>(SchedulerService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('scheduleForTask', () => {
    it('ควร return ทันทีเมื่อไม่มี ReminderRule ที่ match', async () => {
      mockRuleRepo.find.mockResolvedValueOnce([]);
      await service.scheduleForTask(makePayload());
      expect(mockReminderQueue.add).not.toHaveBeenCalled();
    });

    it('ควรเพิ่ม job ลง queue ตาม rules ที่พบ', async () => {
      const rules = [
        {
          id: 1,
          daysBeforeDue: 3,
          reminderType: ReminderType.DUE_SOON,
          isActive: true,
        },
        {
          id: 2,
          daysBeforeDue: 1,
          reminderType: ReminderType.ON_DUE,
          isActive: true,
        },
      ];
      mockRuleRepo.find.mockResolvedValueOnce(rules);
      const payload = makePayload(5); // 5 วันจนถึง due date
      await service.scheduleForTask(payload);
      expect(mockReminderQueue.add).toHaveBeenCalledTimes(2);
    });

    it('ควร skip rule ที่ trigger time ผ่านไปแล้วและไม่ใช่ OVERDUE', async () => {
      // payload due date อยู่ใน 1 วัน แต่ rule บอก 3 วันก่อน (ผ่านไปแล้ว)
      const rules = [
        {
          id: 1,
          daysBeforeDue: 3,
          reminderType: ReminderType.DUE_SOON,
          isActive: true,
        },
      ];
      mockRuleRepo.find.mockResolvedValueOnce(rules);
      const payload = makePayload(1); // due in 1 day → 3 days ago trigger has passed
      await service.scheduleForTask(payload);
      expect(mockReminderQueue.add).not.toHaveBeenCalled();
    });

    it('ควรไม่ skip OVERDUE rule แม้ trigger time ผ่านไปแล้ว (delay=0)', async () => {
      const rules = [
        {
          id: 1,
          daysBeforeDue: 0,
          reminderType: ReminderType.OVERDUE,
          isActive: true,
        },
      ];
      mockRuleRepo.find.mockResolvedValueOnce(rules);
      const pastDuePayload: ScheduleReminderPayload = {
        ...makePayload(0),
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // ผ่าน due date ไปแล้ว
      };
      await service.scheduleForTask(pastDuePayload);
      expect(mockReminderQueue.add).toHaveBeenCalledTimes(1);
      expect(mockReminderQueue.add).toHaveBeenCalledWith(
        'send-reminder',
        expect.objectContaining({ reminderType: ReminderType.OVERDUE }),
        expect.objectContaining({ delay: 0 }) // Math.max(-x, 0) = 0
      );
    });

    it('ควรตั้งค่า jobId ให้ unique ต่อ task + type + rule', async () => {
      const rules = [
        {
          id: 1,
          daysBeforeDue: 2,
          reminderType: ReminderType.DUE_SOON,
          isActive: true,
        },
      ];
      mockRuleRepo.find.mockResolvedValueOnce(rules);
      await service.scheduleForTask(makePayload(5));
      const addCall = mockReminderQueue.add.mock.calls[0];
      const options = addCall[2] as { jobId: string };
      expect(options.jobId).toBe(`task-001-${ReminderType.DUE_SOON}-1`);
    });

    it('ควรตั้งค่า removeOnComplete=true บน job', async () => {
      const rules = [
        {
          id: 1,
          daysBeforeDue: 2,
          reminderType: ReminderType.DUE_SOON,
          isActive: true,
        },
      ];
      mockRuleRepo.find.mockResolvedValueOnce(rules);
      await service.scheduleForTask(makePayload(5));
      const options = mockReminderQueue.add.mock.calls[0][2];
      expect(options.removeOnComplete).toBe(true);
    });

    it('ควรส่ง payload ที่มี reminderType ถูกต้องตาม rule', async () => {
      const rules = [
        {
          id: 1,
          daysBeforeDue: 2,
          reminderType: ReminderType.ESCALATION_L1,
          isActive: true,
        },
      ];
      mockRuleRepo.find.mockResolvedValueOnce(rules);
      const payload = makePayload(5);
      await service.scheduleForTask(payload);
      const jobData = mockReminderQueue.add.mock.calls[0][1];
      expect(jobData.reminderType).toBe(ReminderType.ESCALATION_L1);
      expect(jobData.taskPublicId).toBe('task-001');
    });
  });

  describe('cancelForTask', () => {
    it('ควร remove jobs ที่ตรงกับ taskPublicId', async () => {
      const job1 = makeJob('task-001');
      const job2 = makeJob('task-001');
      const job3 = makeJob('task-002'); // ต่าง task
      mockReminderQueue.getDelayed.mockResolvedValueOnce([job1, job2, job3]);
      await service.cancelForTask('task-001');
      expect(job1.remove).toHaveBeenCalled();
      expect(job2.remove).toHaveBeenCalled();
      expect(job3.remove).not.toHaveBeenCalled();
    });

    it('ควรไม่ error เมื่อไม่มี delayed jobs', async () => {
      mockReminderQueue.getDelayed.mockResolvedValueOnce([]);
      await expect(service.cancelForTask('task-999')).resolves.not.toThrow();
    });

    it('ควรไม่ remove job ของ task อื่น', async () => {
      const otherJob = makeJob('task-XYZ');
      mockReminderQueue.getDelayed.mockResolvedValueOnce([otherJob]);
      await service.cancelForTask('task-001');
      expect(otherJob.remove).not.toHaveBeenCalled();
    });
  });
});
