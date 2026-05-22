// File: src/modules/migration/migration-review.service.spec.ts
// Change Log:
// - 2026-05-22: Initial creation of unit test suite for MigrationReviewService (T020a)
// - 2026-05-22: เพิ่ม FR-007a test cases สำหรับ pessimistic lock + race condition (SELECT FOR UPDATE)
import { Test, TestingModule } from '@nestjs/testing';
import { MigrationReviewService } from './migration-review.service';
import { UuidResolverService } from '../../common/services/uuid-resolver.service';
import { DataSource } from 'typeorm';
import { MigrationReviewStatus } from './entities/migration-review-queue.entity';
describe('MigrationReviewService', () => {
  let service: MigrationReviewService;
  const mockUuidResolverService = {
    resolveProjectId: jest.fn().mockResolvedValue(1),
    resolveOrganizationId: jest.fn().mockResolvedValue(2),
  };
  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      query: jest.fn(),
    },
  };
  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  };
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MigrationReviewService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: UuidResolverService,
          useValue: mockUuidResolverService,
        },
      ],
    }).compile();
    service = module.get<MigrationReviewService>(MigrationReviewService);
    jest.clearAllMocks();
  });
  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  describe('commitRecord — FR-007a: pessimistic lock (SELECT FOR UPDATE)', () => {
    const dto = { publicId: 'test-uuid-001', projectId: 1 };
    const userId = 99;
    it('FR-007a: ควร throw SystemException เมื่อไม่พบ record (NotFoundException wrapped)', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(null);
      await expect(
        service.commitRecord(dto as never, userId)
      ).rejects.toThrow();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
    it('FR-007a: ควร throw SystemException เมื่อ record มี status = IMPORTED (ไม่ใช่ PENDING)', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({
        id: 1,
        publicId: 'test-uuid-001',
        status: MigrationReviewStatus.IMPORTED,
        documentNumber: 'DOC-001',
      });
      await expect(
        service.commitRecord(dto as never, userId)
      ).rejects.toThrow();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
    it('FR-007a: ควร throw SystemException เมื่อ record มี status = REJECTED', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce({
        id: 1,
        publicId: 'test-uuid-001',
        status: MigrationReviewStatus.REJECTED,
        documentNumber: 'DOC-001',
      });
      await expect(
        service.commitRecord(dto as never, userId)
      ).rejects.toThrow();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
    it('FR-007a: ควรเรียก findOne พร้อม lock pessimistic_write เสมอ', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(null);
      await expect(
        service.commitRecord(dto as never, userId)
      ).rejects.toThrow();
      expect(mockQueryRunner.manager.findOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          where: { publicId: dto.publicId },
          lock: { mode: 'pessimistic_write' },
        })
      );
    });
    it('FR-007a: ควร rollback และ release queryRunner เสมอ ไม่ว่าจะ success หรือ error', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(null);
      await expect(
        service.commitRecord(dto as never, userId)
      ).rejects.toThrow();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.release).toHaveBeenCalledTimes(1);
    });
  });
});
