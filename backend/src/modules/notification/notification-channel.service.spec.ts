// File: backend/src/modules/notification/notification-channel.service.spec.ts
// Change Log:
// - 2026-09-25: Initial creation (T033) — NotificationChannelService spec (Feature 258 US2)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';

import {
  NotificationChannelService,
  TelegramGroupJobData,
} from './notification-channel.service';
import {
  NotificationChannel,
  NotificationChannelType,
} from './entities/notification-channel.entity';
import {
  NotificationDelivery,
  DeliveryStatus,
} from './entities/notification-delivery.entity';
import { Project } from '../project/entities/project.entity';
import { UserGroup } from '../organization/entities/user-group.entity';
import { Department } from '../organization/entities/department.entity';
import { QUEUE_NOTIFICATIONS } from '../common/constants/queue.constants';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(<T extends object>(x: T): T => x),
  save: jest.fn(
    <T extends object>(x: T): Promise<T> =>
      Promise.resolve({ publicId: 'del-uuid', ...x } as T)
  ),
  update: jest.fn(
    (): Promise<{ affected: number }> => Promise.resolve({ affected: 1 })
  ),
  remove: jest.fn(),
});

describe('NotificationChannelService', () => {
  let service: NotificationChannelService;
  let channelRepo: ReturnType<typeof mockRepo>;
  let deliveryRepo: ReturnType<typeof mockRepo>;
  let projectRepo: ReturnType<typeof mockRepo>;
  let userGroupRepo: ReturnType<typeof mockRepo>;
  let departmentRepo: ReturnType<typeof mockRepo>;
  let queue: {
    add: jest.Mock<
      Promise<{ id: string }>,
      [string, TelegramGroupJobData, { delay?: number }?]
    >;
  };
  let redis: { set: jest.Mock; get: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    channelRepo = mockRepo();
    deliveryRepo = mockRepo();
    projectRepo = mockRepo();
    userGroupRepo = mockRepo();
    departmentRepo = mockRepo();
    queue = {
      add: jest.fn(
        (): Promise<{ id: string }> => Promise.resolve({ id: 'job-1' })
      ),
    };
    redis = { set: jest.fn(), get: jest.fn(), del: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationChannelService,
        {
          provide: getRepositoryToken(NotificationChannel),
          useValue: channelRepo,
        },
        {
          provide: getRepositoryToken(NotificationDelivery),
          useValue: deliveryRepo,
        },
        { provide: getRepositoryToken(Project), useValue: projectRepo },
        { provide: getRepositoryToken(UserGroup), useValue: userGroupRepo },
        { provide: getRepositoryToken(Department), useValue: departmentRepo },
        { provide: getQueueToken(QUEUE_NOTIFICATIONS), useValue: queue },
        { provide: getRedisConnectionToken(), useValue: redis },
      ],
    }).compile();

    service = module.get(NotificationChannelService);
  });

  describe('issueLinkCode', () => {
    it('issues an 8-char code with TTL stored in Redis', async () => {
      projectRepo.findOne.mockResolvedValue({ id: 7, publicId: 'proj-uuid' });
      const result = await service.issueLinkCode(1, {
        projectPublicId: 'proj-uuid',
        name: 'Site Group',
      });
      expect(result.code).toMatch(/^[0-9A-F]{8}$/);
      expect(result.expiresIn).toBeGreaterThan(0);
      expect(result.projectPublicId).toBe('proj-uuid');
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining(result.code),
        expect.any(String),
        'EX',
        expect.any(Number),
        'NX'
      );
    });

    it('throws NotFoundException for unknown projectPublicId', async () => {
      projectRepo.findOne.mockResolvedValue(null);
      await expect(
        service.issueLinkCode(1, { projectPublicId: 'missing' })
      ).rejects.toThrow();
    });

    it('resolves userGroupPublicId scope into payload userGroupId', async () => {
      userGroupRepo.findOne.mockResolvedValue({ id: 11, publicId: 'g-uuid' });
      await service.issueLinkCode(1, { userGroupPublicId: 'g-uuid' });
      const stored = JSON.parse(
        (redis.set.mock.calls[0] as [string, string])[1]
      ) as { userGroupId?: number };
      expect(stored.userGroupId).toBe(11);
    });

    it('resolves departmentPublicId scope into payload departmentId', async () => {
      departmentRepo.findOne.mockResolvedValue({ id: 5, publicId: 'd-uuid' });
      await service.issueLinkCode(1, { departmentPublicId: 'd-uuid' });
      const stored = JSON.parse(
        (redis.set.mock.calls[0] as [string, string])[1]
      ) as { departmentId?: number };
      expect(stored.departmentId).toBe(5);
    });

    it('rejects when zero or multiple scopes provided', async () => {
      await expect(service.issueLinkCode(1, {})).rejects.toThrow();
      await expect(
        service.issueLinkCode(1, {
          projectPublicId: 'p',
          userGroupPublicId: 'g',
        })
      ).rejects.toThrow();
    });
  });

  describe('bindFromCode', () => {
    const payload = JSON.stringify({
      projectId: 7,
      projectPublicId: 'p',
      issuedBy: 1,
      iat: 1,
    });

    it('rejects invalid/expired code', async () => {
      redis.get.mockResolvedValue(null);
      await expect(
        service.bindFromCode('BAD', { externalChatId: '-100' })
      ).rejects.toThrow();
    });

    it('rejects duplicate whole-group bind (NULL topic, app-layer guard)', async () => {
      redis.get.mockResolvedValue(payload);
      channelRepo.findOne.mockResolvedValue({ id: 9 });
      await expect(
        service.bindFromCode('ABC12345', { externalChatId: '-100' })
      ).rejects.toThrow();
    });

    it('binds channel to user group scope when payload has userGroupId', async () => {
      redis.get.mockResolvedValue(
        JSON.stringify({ userGroupId: 11, issuedBy: 1, iat: 1 })
      );
      channelRepo.findOne.mockResolvedValue(null);
      await service.bindFromCode('ABC12345', { externalChatId: '-100' });
      expect(channelRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userGroupId: 11 })
      );
    });

    it('creates channel with telegramTopicId when bound inside a forum topic', async () => {
      redis.get.mockResolvedValue(payload);
      channelRepo.findOne.mockResolvedValue(null);
      await service.bindFromCode('ABC12345', {
        externalChatId: '-100',
        telegramTopicId: 42,
        name: 'Correspondences',
      });
      expect(channelRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          channelType: NotificationChannelType.TELEGRAM_GROUP,
          externalChatId: '-100',
          telegramTopicId: 42,
          projectId: 7,
        })
      );
      expect(redis.del).toHaveBeenCalled(); // single-use
    });
  });

  describe('notifyProject', () => {
    it('enqueues one job per active channel carrying messageThreadId', async () => {
      channelRepo.find.mockResolvedValue([
        {
          id: 1,
          externalChatId: '-100',
          telegramTopicId: null,
          isActive: true,
        },
        { id: 2, externalChatId: '-100', telegramTopicId: 42, isActive: true },
      ]);
      const count = await service.notifyProject(7, 'transmittal.received', {
        text: 'hello',
        entityPublicId: 'doc-uuid',
      });
      expect(count).toBe(2);
      expect(queue.add).toHaveBeenCalledTimes(2);
      const jobs = queue.add.mock.calls.map(
        (c: [string, TelegramGroupJobData]) => c[1]
      );
      expect(jobs[0].messageThreadId).toBeNull();
      expect(jobs[1].messageThreadId).toBe(42);
      expect(deliveryRepo.save).toHaveBeenCalledTimes(2);
      expect(deliveryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: DeliveryStatus.PENDING })
      );
      // T047 (Q2): group sends เป็น real-time เสมอ — job options ต้องไม่มี delay
      for (const call of queue.add.mock.calls) {
        const opts = call[2] as { delay?: number } | undefined;
        expect(opts?.delay).toBeUndefined();
      }
    });

    it('returns 0 and enqueues nothing when no active channels', async () => {
      channelRepo.find.mockResolvedValue([]);
      const count = await service.notifyProject(7, 'evt', { text: 'x' });
      expect(count).toBe(0);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('notifyUserGroup fans out to channels bound to the group', async () => {
      channelRepo.find.mockResolvedValue([
        { id: 3, externalChatId: '-100', telegramTopicId: 9, isActive: true },
      ]);
      const count = await service.notifyUserGroup(11, 'circulation.assigned', {
        text: 'hi',
      });
      expect(count).toBe(1);
      expect(channelRepo.find).toHaveBeenCalledWith({
        where: { userGroupId: 11, isActive: true },
      });
      expect(queue.add).toHaveBeenCalledTimes(1);
    });

    it('notifyDepartment fans out to channels bound to the department', async () => {
      channelRepo.find.mockResolvedValue([
        {
          id: 4,
          externalChatId: '-100',
          telegramTopicId: null,
          isActive: true,
        },
      ]);
      const count = await service.notifyDepartment(5, 'announce', {
        text: 'hi',
      });
      expect(count).toBe(1);
      expect(channelRepo.find).toHaveBeenCalledWith({
        where: { departmentId: 5, isActive: true },
      });
    });
  });

  describe('handleBotRemoved / markInactive', () => {
    it('marks all channels of a chat inactive with lastError', async () => {
      await service.handleBotRemoved('-100');
      expect(channelRepo.update).toHaveBeenCalledWith(
        { externalChatId: '-100', isActive: true },
        { isActive: false, lastError: 'BOT_REMOVED_FROM_CHAT' }
      );
    });

    it('markInactive stores truncated error', async () => {
      await service.markInactive(3, 'x'.repeat(500));
      const [, data] = channelRepo.update.mock.calls[0] as [
        unknown,
        { lastError: string },
      ];
      expect(data.lastError.length).toBe(255);
    });
  });

  describe('delete', () => {
    it('nulls channelId on deliveries then removes channel (app-level SET NULL)', async () => {
      channelRepo.findOne.mockResolvedValue({ id: 5, publicId: 'ch-uuid' });
      await service.delete('ch-uuid');
      expect(deliveryRepo.update).toHaveBeenCalled();
      expect(channelRepo.remove).toHaveBeenCalled();
    });
  });
});
