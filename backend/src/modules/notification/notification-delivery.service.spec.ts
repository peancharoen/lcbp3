// File: backend/src/modules/notification/notification-delivery.service.spec.ts
// Change Log:
// - 2026-09-25: Initial creation (T050) — NotificationDeliveryService spec (Feature 258 US4)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { NotificationDeliveryService } from './notification-delivery.service';
import {
  NotificationDelivery,
  DeliveryStatus,
} from './entities/notification-delivery.entity';
import { NotificationType } from './entities/notification.entity';

describe('NotificationDeliveryService (Feature 258 US4)', () => {
  let service: NotificationDeliveryService;
  let repo: {
    save: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    findOne: jest.Mock;
    findAndCount: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      save: jest.fn((x: unknown) => Promise.resolve(x)),
      create: jest.fn((x: unknown) => x),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      findOne: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationDeliveryService,
        {
          provide: getRepositoryToken(NotificationDelivery),
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get(NotificationDeliveryService);
  });

  it('record() creates a PENDING delivery row', async () => {
    await service.record({
      channelType: NotificationType.TELEGRAM,
      target: '777888999',
      eventType: 'rfa.pending_approval',
    });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: DeliveryStatus.PENDING })
    );
    expect(repo.save).toHaveBeenCalled();
  });

  it('markSent() transitions PENDING → SENT with sentAt', async () => {
    await service.markSent('uuid-1');
    expect(repo.update).toHaveBeenCalledWith(
      { publicId: 'uuid-1' },
      expect.objectContaining({ status: DeliveryStatus.SENT })
    );
  });

  it('markFailed() stores errorCode + truncated message', async () => {
    await service.markFailed('uuid-1', 'BOT_BLOCKED', 'x'.repeat(600));
    const [, data] = repo.update.mock.calls[0] as [
      unknown,
      { errorCode: string; errorMessage: string },
    ];
    expect(data.errorCode).toBe('BOT_BLOCKED');
    expect(data.errorMessage.length).toBe(500);
  });

  it('isPermanentCode() recognizes permanent failure codes', () => {
    expect(service.isPermanentCode('BOT_BLOCKED')).toBe(true);
    expect(service.isPermanentCode('CHAT_NOT_FOUND')).toBe(true);
    expect(service.isPermanentCode('RATE_LIMITED')).toBe(false);
  });

  it('list() applies filters with pagination', async () => {
    await service.list({
      channelType: NotificationType.TELEGRAM,
      status: DeliveryStatus.FAILED,
      page: 2,
      limit: 25,
    });
    expect(repo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          channelType: NotificationType.TELEGRAM,
          status: DeliveryStatus.FAILED,
        }),
        skip: 25,
        take: 25,
      })
    );
  });
});
