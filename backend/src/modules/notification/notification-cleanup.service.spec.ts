// File: backend/src/modules/notification/notification-cleanup.service.spec.ts
// Change Log:
// - 2026-06-20: Initial creation — unit tests สำหรับ NotificationCleanupService

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationCleanupService } from './notification-cleanup.service';
import { Notification } from './entities/notification.entity';
import { NotificationDelivery } from './entities/notification-delivery.entity';

/**
 * Helper สร้าง mock QueryBuilder ที่ support chaining สำหรับ delete operations
 */
function createMockDeleteQueryBuilder(
  overrides: Record<string, jest.Mock> = {}
) {
  const qb: Record<string, jest.Mock> = {
    delete: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 5 }),
    ...overrides,
  };
  return qb;
}

describe('NotificationCleanupService', () => {
  let service: NotificationCleanupService;
  let mockNotificationRepo: Record<string, jest.Mock>;
  let mockDeliveryRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockNotificationRepo = {
      createQueryBuilder: jest.fn(() => createMockDeleteQueryBuilder()),
    };
    mockDeliveryRepo = {
      createQueryBuilder: jest.fn(() => createMockDeleteQueryBuilder()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationCleanupService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationRepo,
        },
        {
          provide: getRepositoryToken(NotificationDelivery),
          useValue: mockDeliveryRepo,
        },
      ],
    }).compile();

    service = module.get<NotificationCleanupService>(
      NotificationCleanupService
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleCleanup', () => {
    it('should delete read notifications older than 30 days', async () => {
      const qb = createMockDeleteQueryBuilder({
        execute: jest.fn().mockResolvedValue({ affected: 10 }),
      });
      mockNotificationRepo.createQueryBuilder.mockReturnValue(qb);

      await service.handleCleanup();

      expect(qb.delete).toHaveBeenCalled();
      expect(qb.from).toHaveBeenCalledWith(Notification);
      expect(qb.where).toHaveBeenCalledWith('is_read = :isRead', {
        isRead: true,
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'created_at < :dateThreshold',
        expect.objectContaining({ dateThreshold: expect.any(Date) })
      );
      expect(qb.execute).toHaveBeenCalled();
    });

    it('should handle errors gracefully without throwing', async () => {
      const qb = createMockDeleteQueryBuilder({
        execute: jest.fn().mockRejectedValue(new Error('DB connection failed')),
      });
      mockNotificationRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(service.handleCleanup()).resolves.not.toThrow();
    });

    it('should handle non-Error rejections', async () => {
      const qb = createMockDeleteQueryBuilder({
        execute: jest.fn().mockRejectedValue('string error'),
      });
      mockNotificationRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(service.handleCleanup()).resolves.not.toThrow();
    });

    it('should calculate date threshold as 30 days ago', async () => {
      const qb = createMockDeleteQueryBuilder();
      mockNotificationRepo.createQueryBuilder.mockReturnValue(qb);

      await service.handleCleanup();

      const thresholdArg = (qb.andWhere.mock.calls[0] as unknown[])[1] as {
        dateThreshold: Date;
      };
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - 30);
      expect(thresholdArg.dateThreshold.getDate()).toBe(expectedDate.getDate());
    });
  });

  describe('handleDeliveryCleanup (Feature 258, D11f)', () => {
    it('should delete notification_deliveries rows older than 90 days', async () => {
      const qb = createMockDeleteQueryBuilder({
        execute: jest.fn().mockResolvedValue({ affected: 3 }),
      });
      mockDeliveryRepo.createQueryBuilder.mockReturnValue(qb);

      await service.handleDeliveryCleanup();

      expect(qb.delete).toHaveBeenCalled();
      expect(qb.from).toHaveBeenCalledWith(NotificationDelivery);
      expect(qb.where).toHaveBeenCalledWith(
        'created_at < :dateThreshold',
        expect.objectContaining({ dateThreshold: expect.any(Date) })
      );
      expect(qb.execute).toHaveBeenCalled();
    });

    it('should use a 90-day threshold', async () => {
      const qb = createMockDeleteQueryBuilder();
      mockDeliveryRepo.createQueryBuilder.mockReturnValue(qb);

      await service.handleDeliveryCleanup();

      const arg = (qb.where.mock.calls[0] as unknown[])[1] as {
        dateThreshold: Date;
      };
      const expected = new Date();
      expected.setDate(expected.getDate() - 90);
      expect(arg.dateThreshold.getDate()).toBe(expected.getDate());
    });

    it('should not throw on delivery cleanup failure', async () => {
      const qb = createMockDeleteQueryBuilder({
        execute: jest.fn().mockRejectedValue(new Error('partition error')),
      });
      mockDeliveryRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(service.handleDeliveryCleanup()).resolves.not.toThrow();
    });
  });
});
