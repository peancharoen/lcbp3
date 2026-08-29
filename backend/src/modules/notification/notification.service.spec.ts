// File: backend/src/modules/notification/notification.service.spec.ts
// Change Log:
// - 2026-06-20: Initial creation — unit tests สำหรับ NotificationService

import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { Notification, NotificationType } from './entities/notification.entity';
import { User } from '../user/entities/user.entity';
import { NotificationGateway } from './notification.gateway';
import { SearchNotificationDto } from './dto/search-notification.dto';

/**
 * Helper สร้าง mock QueryBuilder ที่ support chaining
 */
function createMockQueryBuilder(overrides: Record<string, jest.Mock> = {}) {
  const qb: Record<string, jest.Mock> = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    delete: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 0 }),
    ...overrides,
  };
  return qb;
}

describe('NotificationService', () => {
  let service: NotificationService;
  let mockQueue: Record<string, jest.Mock>;
  let mockNotificationRepo: Record<string, jest.Mock>;
  let mockUserRepo: Record<string, jest.Mock>;
  let mockGateway: { sendToUser: jest.Mock };

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue(undefined),
    };
    mockNotificationRepo = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
    };
    mockUserRepo = {};
    mockGateway = {
      sendToUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: getQueueToken('notifications'), useValue: mockQueue },
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationRepo,
        },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: NotificationGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('send', () => {
    it('should create, save, push via gateway, and queue a notification', async () => {
      const savedNotif = { id: 1, userId: 5, title: 'Test', message: 'Hello' };
      mockNotificationRepo.save.mockResolvedValue(savedNotif);

      await service.send({
        userId: 5,
        title: 'Test',
        message: 'Hello',
        type: 'SYSTEM',
      });

      expect(mockNotificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 5,
          title: 'Test',
          message: 'Hello',
          notificationType: NotificationType.SYSTEM,
          isRead: false,
        })
      );
      expect(mockNotificationRepo.save).toHaveBeenCalled();
      expect(mockGateway.sendToUser).toHaveBeenCalledWith(5, savedNotif);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'dispatch-notification',
        expect.objectContaining({
          userId: 5,
          title: 'Test',
          message: 'Hello',
          notificationId: 1,
        }),
        expect.objectContaining({
          attempts: 3,
          removeOnComplete: true,
        })
      );
    });

    it('should handle errors gracefully without throwing', async () => {
      mockNotificationRepo.save.mockRejectedValue(new Error('DB error'));

      await expect(
        service.send({
          userId: 5,
          title: 'Test',
          message: 'Hello',
          type: 'EMAIL',
        })
      ).resolves.not.toThrow();
    });

    it('should include entityType and entityId when provided', async () => {
      const savedNotif = { id: 2, userId: 5 };
      mockNotificationRepo.save.mockResolvedValue(savedNotif);

      await service.send({
        userId: 5,
        title: 'Test',
        message: 'Hello',
        type: 'LINE',
        entityType: 'correspondence',
        entityId: 100,
        link: '/docs/100',
      });

      expect(mockNotificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'correspondence',
          entityId: 100,
        })
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated notifications with unread count', async () => {
      const mockNotifs = [{ id: 1, title: 'Test' }];
      const qb = createMockQueryBuilder({
        getManyAndCount: jest.fn().mockResolvedValue([mockNotifs, 1]),
      });
      mockNotificationRepo.createQueryBuilder.mockReturnValue(qb);
      mockNotificationRepo.count.mockResolvedValue(3);

      const dto = new SearchNotificationDto();
      dto.page = 1;
      dto.limit = 20;

      const result = await service.findAll(5, dto);

      expect(result.data).toEqual(mockNotifs);
      expect(result.meta.total).toBe(1);
      expect(result.meta.unreadCount).toBe(3);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should filter by isRead when provided', async () => {
      const qb = createMockQueryBuilder();
      mockNotificationRepo.createQueryBuilder.mockReturnValue(qb);
      mockNotificationRepo.count.mockResolvedValue(0);

      const dto = new SearchNotificationDto();
      dto.isRead = true;

      await service.findAll(5, dto);

      expect(qb.andWhere).toHaveBeenCalledWith(
        'notification.isRead = :isRead',
        { isRead: true }
      );
    });

    it('should not filter by isRead when undefined', async () => {
      const qb = createMockQueryBuilder();
      mockNotificationRepo.createQueryBuilder.mockReturnValue(qb);
      mockNotificationRepo.count.mockResolvedValue(0);

      const dto = new SearchNotificationDto();

      await service.findAll(5, dto);

      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('should use custom page and limit', async () => {
      const qb = createMockQueryBuilder();
      mockNotificationRepo.createQueryBuilder.mockReturnValue(qb);
      mockNotificationRepo.count.mockResolvedValue(0);

      const dto = new SearchNotificationDto();
      dto.page = 2;
      dto.limit = 10;

      const result = await service.findAll(5, dto);

      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(10);
      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(10);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count for user', async () => {
      mockNotificationRepo.count.mockResolvedValue(5);

      const result = await service.getUnreadCount(5);

      expect(result).toBe(5);
      expect(mockNotificationRepo.count).toHaveBeenCalledWith({
        where: { userId: 5, isRead: false },
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark an unread notification as read', async () => {
      const notif = { id: 1, userId: 5, isRead: false };
      mockNotificationRepo.findOne.mockResolvedValue(notif);
      mockNotificationRepo.save.mockResolvedValue({ ...notif, isRead: true });

      await service.markAsRead(1, 5);

      expect(mockNotificationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isRead: true })
      );
    });

    it('should not save if already read', async () => {
      const notif = { id: 1, userId: 5, isRead: true };
      mockNotificationRepo.findOne.mockResolvedValue(notif);

      await service.markAsRead(1, 5);

      expect(mockNotificationRepo.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when notification not found', async () => {
      mockNotificationRepo.findOne.mockResolvedValue(null);

      await expect(service.markAsRead(999, 5)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('markAsReadByUuid', () => {
    it('should mark an unread notification as read by uuid', async () => {
      const notif = { id: 1, publicId: 'uuid-1', userId: 5, isRead: false };
      mockNotificationRepo.findOne.mockResolvedValue(notif);
      mockNotificationRepo.save.mockResolvedValue({ ...notif, isRead: true });

      await service.markAsReadByUuid('uuid-1', 5);

      expect(mockNotificationRepo.findOne).toHaveBeenCalledWith({
        where: { publicId: 'uuid-1', userId: 5 },
      });
      expect(mockNotificationRepo.save).toHaveBeenCalled();
    });

    it('should not save if already read', async () => {
      const notif = { id: 1, publicId: 'uuid-1', userId: 5, isRead: true };
      mockNotificationRepo.findOne.mockResolvedValue(notif);

      await service.markAsReadByUuid('uuid-1', 5);

      expect(mockNotificationRepo.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when notification not found', async () => {
      mockNotificationRepo.findOne.mockResolvedValue(null);

      await expect(service.markAsReadByUuid('nonexistent', 5)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should update all unread notifications for user', async () => {
      mockNotificationRepo.update.mockResolvedValue({ affected: 5 });

      await service.markAllAsRead(5);

      expect(mockNotificationRepo.update).toHaveBeenCalledWith(
        { userId: 5, isRead: false },
        { isRead: true }
      );
    });
  });

  describe('cleanupOldNotifications', () => {
    it('should delete old notifications and return affected count', async () => {
      const qb = createMockQueryBuilder({
        execute: jest.fn().mockResolvedValue({ affected: 10 }),
      });
      mockNotificationRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.cleanupOldNotifications(90);

      expect(result).toBe(10);
      expect(qb.delete).toHaveBeenCalled();
      expect(qb.from).toHaveBeenCalledWith(Notification);
      expect(qb.where).toHaveBeenCalledWith(
        'createdAt < :dateLimit',
        expect.objectContaining({ dateLimit: expect.any(Date) })
      );
    });

    it('should return 0 when affected is null', async () => {
      const qb = createMockQueryBuilder({
        execute: jest.fn().mockResolvedValue({ affected: null }),
      });
      mockNotificationRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.cleanupOldNotifications();

      expect(result).toBe(0);
    });

    it('should use default 90 days', async () => {
      const qb = createMockQueryBuilder({
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      });
      mockNotificationRepo.createQueryBuilder.mockReturnValue(qb);

      await service.cleanupOldNotifications();

      const dateLimitCall = (qb.where.mock.calls[0] as unknown[])[1] as {
        dateLimit: Date;
      };
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - 90);
      expect(dateLimitCall.dateLimit.getDate()).toBe(expectedDate.getDate());
    });
  });
});
