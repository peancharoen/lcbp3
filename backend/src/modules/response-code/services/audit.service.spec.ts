// File: src/modules/response-code/services/audit.service.spec.ts
// Change Log:
// - 2026-05-21: เพิ่ม unit tests สำหรับ ResponseCodeAuditService

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ResponseCodeAuditService } from './audit.service';
import { AuditLog } from '../../../common/entities/audit-log.entity';

describe('ResponseCodeAuditService', () => {
  let service: ResponseCodeAuditService;
  const mockAuditLog: Partial<AuditLog> = {
    userId: 1,
    action: 'response_code.change',
    severity: 'INFO',
    entityType: 'review_task',
    entityId: 'task-uuid-001',
    detailsJson: {},
  };
  const mockAuditLogRepo = {
    create: jest.fn().mockReturnValue(mockAuditLog),
    save: jest.fn().mockResolvedValue(mockAuditLog),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResponseCodeAuditService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockAuditLogRepo,
        },
      ],
    }).compile();
    service = module.get<ResponseCodeAuditService>(ResponseCodeAuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logReviewTaskResponseCodeChange', () => {
    it('ควรบันทึก audit log พร้อมข้อมูลครบถ้วน (Happy Path)', async () => {
      await service.logReviewTaskResponseCodeChange({
        reviewTaskPublicId: 'task-uuid-001',
        responseCodePublicId: 'rc-uuid-001',
        previousResponseCodeId: 1,
        currentResponseCodeId: 2,
        comments: 'Changed from 1A to 2',
        userId: 10,
      });
      expect(mockAuditLogRepo.create).toHaveBeenCalledWith({
        userId: 10,
        action: 'response_code.change',
        severity: 'INFO',
        entityType: 'review_task',
        entityId: 'task-uuid-001',
        detailsJson: {
          previousResponseCodeId: 1,
          currentResponseCodeId: 2,
          responseCodePublicId: 'rc-uuid-001',
          comments: 'Changed from 1A to 2',
        },
      });
      expect(mockAuditLogRepo.save).toHaveBeenCalledTimes(1);
    });

    it('ควร default userId เป็น null เมื่อไม่ระบุ', async () => {
      await service.logReviewTaskResponseCodeChange({
        reviewTaskPublicId: 'task-uuid-002',
        responseCodePublicId: 'rc-uuid-002',
        currentResponseCodeId: 3,
      });
      expect(mockAuditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: null })
      );
    });

    it('ควร default previousResponseCodeId เป็น null เมื่อไม่ระบุ', async () => {
      await service.logReviewTaskResponseCodeChange({
        reviewTaskPublicId: 'task-uuid-003',
        responseCodePublicId: 'rc-uuid-003',
        currentResponseCodeId: 1,
      });
      expect(mockAuditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          detailsJson: expect.objectContaining({
            previousResponseCodeId: null,
          }),
        })
      );
    });

    it('ควร default comments เป็น null เมื่อไม่ระบุ', async () => {
      await service.logReviewTaskResponseCodeChange({
        reviewTaskPublicId: 'task-uuid-004',
        responseCodePublicId: 'rc-uuid-004',
        currentResponseCodeId: 2,
      });
      expect(mockAuditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          detailsJson: expect.objectContaining({ comments: null }),
        })
      );
    });

    it('ควร throw เมื่อ repo.save ล้มเหลว', async () => {
      mockAuditLogRepo.save.mockRejectedValueOnce(new Error('DB Error'));
      await expect(
        service.logReviewTaskResponseCodeChange({
          reviewTaskPublicId: 'task-uuid-005',
          responseCodePublicId: 'rc-uuid-005',
          currentResponseCodeId: 1,
        })
      ).rejects.toThrow('DB Error');
    });
  });
});
