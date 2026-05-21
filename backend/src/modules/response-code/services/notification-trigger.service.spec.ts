// File: src/modules/response-code/services/notification-trigger.service.spec.ts
// Change Log:
// - 2026-05-21: เพิ่ม unit tests สำหรับ NotificationTriggerService (FR-007)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationTriggerService } from './notification-trigger.service';
import { ResponseCode } from '../entities/response-code.entity';
import { User } from '../../user/entities/user.entity';
import { NotificationService } from '../../notification/notification.service';
import { ImplicationsService } from './implications.service';

const mockResponseCode = {
  id: 1,
  publicId: 'rc-3',
  code: '3',
  descriptionEn: 'Rejected',
  notifyRoles: ['CONTRACT_MANAGER'],
  implications: {},
};

describe('NotificationTriggerService', () => {
  let service: NotificationTriggerService;
  const mockRcRepo = { findOne: jest.fn() };
  const mockUserRepo = {
    createQueryBuilder: jest.fn(),
  };
  const mockNotificationService = {
    send: jest.fn().mockResolvedValue(undefined),
  };
  const mockImplicationsService = { evaluate: jest.fn() };

  // Helper สำหรับ query builder chain
  const makeQB = (users: Partial<User>[]) => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(users),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationTriggerService,
        { provide: getRepositoryToken(ResponseCode), useValue: mockRcRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: ImplicationsService, useValue: mockImplicationsService },
      ],
    }).compile();
    service = module.get<NotificationTriggerService>(
      NotificationTriggerService
    );
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('triggerIfRequired', () => {
    it('ควร return ทันทีเมื่อ ResponseCode ไม่พบ (warn, no throw)', async () => {
      mockRcRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.triggerIfRequired('not-found', 'rfa-1', 'DOC-001', 1)
      ).resolves.not.toThrow();
      expect(mockNotificationService.send).not.toHaveBeenCalled();
    });

    it('ควร return ทันทีเมื่อ severity=LOW', async () => {
      mockRcRepo.findOne.mockResolvedValueOnce(mockResponseCode);
      mockImplicationsService.evaluate.mockReturnValueOnce({
        severity: 'LOW',
        notifyRoles: [],
        actionRequired: [],
      });
      await service.triggerIfRequired('rc-3', 'rfa-1', 'DOC-001', 1);
      expect(mockNotificationService.send).not.toHaveBeenCalled();
    });

    it('ควร return ทันทีเมื่อ notifyRoles ว่าง (severity != LOW)', async () => {
      mockRcRepo.findOne.mockResolvedValueOnce(mockResponseCode);
      mockImplicationsService.evaluate.mockReturnValueOnce({
        severity: 'CRITICAL',
        notifyRoles: [],
        actionRequired: [],
      });
      await service.triggerIfRequired('rc-3', 'rfa-1', 'DOC-001', 1);
      expect(mockNotificationService.send).not.toHaveBeenCalled();
    });

    it('ควรส่งแจ้งเตือนถึง user ที่มี role ที่เกี่ยวข้อง', async () => {
      mockRcRepo.findOne.mockResolvedValueOnce(mockResponseCode);
      mockImplicationsService.evaluate.mockReturnValueOnce({
        severity: 'CRITICAL',
        notifyRoles: ['CONTRACT_MANAGER'],
        actionRequired: ['Contract review required'],
      });
      const targetUser = { user_id: 99 } as User;
      const qb = makeQB([targetUser]);
      mockUserRepo.createQueryBuilder.mockReturnValueOnce(qb);
      await service.triggerIfRequired('rc-3', 'rfa-001', 'DOC-001', 1);
      expect(mockNotificationService.send).toHaveBeenCalledTimes(1);
      expect(mockNotificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 99,
          type: 'SYSTEM',
          entityType: 'rfa',
        })
      );
    });

    it('ควรส่งแจ้งเตือนแบบ parallel ถึงหลาย users', async () => {
      mockRcRepo.findOne.mockResolvedValueOnce(mockResponseCode);
      mockImplicationsService.evaluate.mockReturnValueOnce({
        severity: 'HIGH',
        notifyRoles: ['CONTRACT_MANAGER'],
        actionRequired: [],
      });
      const users = [{ user_id: 1 }, { user_id: 2 }, { user_id: 3 }] as User[];
      const qb = makeQB(users);
      mockUserRepo.createQueryBuilder.mockReturnValueOnce(qb);
      await service.triggerIfRequired('rc-1C', 'rfa-002', 'DOC-002', 5);
      expect(mockNotificationService.send).toHaveBeenCalledTimes(3);
    });

    it('ควร return ทันทีเมื่อไม่พบ users ที่ match roles', async () => {
      mockRcRepo.findOne.mockResolvedValueOnce(mockResponseCode);
      mockImplicationsService.evaluate.mockReturnValueOnce({
        severity: 'HIGH',
        notifyRoles: ['CONTRACT_MANAGER'],
        actionRequired: [],
      });
      const qb = makeQB([]); // ไม่มี users
      mockUserRepo.createQueryBuilder.mockReturnValueOnce(qb);
      await service.triggerIfRequired('rc-1C', 'rfa-003', 'DOC-003', 5);
      expect(mockNotificationService.send).not.toHaveBeenCalled();
    });
  });
});
