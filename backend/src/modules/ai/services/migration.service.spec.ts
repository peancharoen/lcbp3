// File: backend/src/modules/ai/services/migration.service.spec.ts
// Change Log:
// - 2026-06-15: สร้าง unit test สำหรับ MigrationService ครอบคลุม queueForReview, findAll, approve, reject (T030, ADR-023A)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { Repository, DataSource } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { MigrationService } from './migration.service';
import {
  MigrationReviewRecord,
  MigrationReviewRecordStatus,
} from '../entities/migration-review.entity';
import { MigrationQueueItemDto } from '../dto/migration-queue-item.dto';
import { User } from '../../user/entities/user.entity';

/**
 * Unit tests สำหรับ MigrationService
 * ครอบคลุม: queueForReview (idempotency + new), findAll (with/without status filter),
 * approve (success/not found/wrong status), reject (success/not found)
 */
describe('MigrationService', () => {
  let service: MigrationService;
  let migrationRepo: jest.Mocked<Repository<MigrationReviewRecord>>;
  let aiBatchQueue: { add: jest.Mock };

  const mockUser: Partial<User> = {
    user_id: 42,
    username: 'admin',
  };

  const mockRecord: MigrationReviewRecord = {
    id: 1,
    publicId: 'migrate-uuid-001',
    batchId: 'batch-2026-06-15',
    idempotencyKey: 'idem-key-001',
    originalFilename: 'INV-2026-001.pdf',
    storageTempPath: 'temp/migration/batch-1/INV-001.pdf',
    aiMetadataJson: {},
    confidenceScore: 0,
    ocrUsed: false,
    status: MigrationReviewRecordStatus.PENDING,
    version: 1,
    createdAt: new Date('2026-06-15T00:00:00Z'),
    updatedAt: new Date('2026-06-15T00:00:00Z'),
  } as MigrationReviewRecord;

  const mockDto: MigrationQueueItemDto = {
    batchId: 'batch-2026-06-15',
    filename: 'INV-2026-001.pdf',
    tempPath: 'temp/migration/batch-1/INV-001.pdf',
    projectPublicId: 'proj-uuid-001',
  };

  /** Mock QueryBuilder สำหรับ findAll */
  const mockQueryBuilder = {
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MigrationService,
        {
          provide: getRepositoryToken(MigrationReviewRecord),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
          },
        },
        {
          provide: getQueueToken('ai-batch'),
          useValue: {
            add: jest.fn().mockResolvedValue({ id: 'job-1' }),
          },
        },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<MigrationService>(MigrationService);
    migrationRepo = module.get(getRepositoryToken(MigrationReviewRecord));
    aiBatchQueue = module.get(getQueueToken('ai-batch'));
    jest.clearAllMocks();
    // reset queryBuilder mocks
    mockQueryBuilder.orderBy.mockReturnThis();
    mockQueryBuilder.skip.mockReturnThis();
    mockQueryBuilder.take.mockReturnThis();
    mockQueryBuilder.andWhere.mockReturnThis();
    mockQueryBuilder.getManyAndCount.mockReset();
  });

  describe('queueForReview', () => {
    it('ควรคืน existing record เมื่อ idempotencyKey ซ้ำ (idempotent)', async () => {
      migrationRepo.findOne.mockResolvedValue(mockRecord);

      const result = await service.queueForReview(mockDto, 'idem-key-001');

      expect(result.publicId).toBe('migrate-uuid-001');
      expect(migrationRepo.create).not.toHaveBeenCalled();
      expect(aiBatchQueue.add).not.toHaveBeenCalled();
    });

    it('ควรสร้าง record ใหม่และ queue AI processing เมื่อ idempotencyKey ใหม่', async () => {
      migrationRepo.findOne.mockResolvedValue(null);
      const newRecord = { ...mockRecord, publicId: 'migrate-uuid-002' };
      migrationRepo.create.mockReturnValue(newRecord);
      migrationRepo.save.mockResolvedValue(newRecord);

      const result = await service.queueForReview(mockDto, 'idem-key-new');

      expect(result.publicId).toBe('migrate-uuid-002');
      expect(migrationRepo.create).toHaveBeenCalledWith({
        batchId: mockDto.batchId,
        idempotencyKey: 'idem-key-new',
        originalFilename: mockDto.filename,
        storageTempPath: mockDto.tempPath,
        status: MigrationReviewRecordStatus.PENDING,
        aiMetadataJson: {},
        confidenceScore: 0,
      });
      expect(aiBatchQueue.add).toHaveBeenCalledWith(
        'extract-metadata',
        expect.objectContaining({
          migrationQueuePublicId: 'migrate-uuid-002',
          tempPath: mockDto.tempPath,
          filename: mockDto.filename,
          projectPublicId: mockDto.projectPublicId,
        })
      );
    });
  });

  describe('findAll', () => {
    it('ควรดึงรายการแบบ paginate โดยไม่มี status filter', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockRecord], 1]);

      const result = await service.findAll(1, 20);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
    });

    it('ควรกรองตาม status เมื่อส่ง status parameter', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([], 0);

      const result = await service.findAll(1, 10, 'PENDING');

      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'q.status = :status',
        { status: 'PENDING' }
      );
    });

    it('ควรคำนวณ skip ที่ถูกต้องสำหรับ page 2', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([], 0);

      await service.findAll(2, 15);

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(15);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(15);
    });
  });

  describe('approve', () => {
    it('ควร approve item ที่อยู่ในสถานะ PENDING สำเร็จ', async () => {
      migrationRepo.findOne.mockResolvedValue(mockRecord);
      const approvedRecord = {
        ...mockRecord,
        status: MigrationReviewRecordStatus.IMPORTED,
        reviewedBy: 42,
        reviewedAt: new Date(),
      };
      migrationRepo.save.mockResolvedValue(approvedRecord);

      const result = await service.approve(
        'migrate-uuid-001',
        mockUser as User
      );

      expect(result.status).toBe(MigrationReviewRecordStatus.IMPORTED);
      expect(result.reviewedBy).toBe(42);
      expect(result.reviewedAt).toBeDefined();
      expect(migrationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: MigrationReviewRecordStatus.IMPORTED,
          reviewedBy: 42,
        })
      );
    });

    it('ควร throw NotFoundException เมื่อไม่เจอ item', async () => {
      migrationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.approve('not-exists', mockUser as User)
      ).rejects.toThrow(NotFoundException);
    });

    it('ควร throw BadRequestException เมื่อ item ไม่อยู่ในสถานะ PENDING', async () => {
      const importedRecord = {
        ...mockRecord,
        status: MigrationReviewRecordStatus.IMPORTED,
      };
      migrationRepo.findOne.mockResolvedValue(importedRecord);

      await expect(
        service.approve('migrate-uuid-001', mockUser as User)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reject', () => {
    it('ควร reject item สำเร็จ พร้อมบันทึก rejectionReason', async () => {
      migrationRepo.findOne.mockResolvedValue(mockRecord);
      const rejectedRecord = {
        ...mockRecord,
        status: MigrationReviewRecordStatus.REJECTED,
        reviewedBy: 42,
        reviewedAt: new Date(),
        rejectionReason: 'invalid document',
      };
      migrationRepo.save.mockResolvedValue(rejectedRecord);

      const result = await service.reject(
        'migrate-uuid-001',
        mockUser as User,
        'invalid document'
      );

      expect(result.status).toBe(MigrationReviewRecordStatus.REJECTED);
      expect(result.rejectionReason).toBe('invalid document');
      expect(result.reviewedBy).toBe(42);
      expect(migrationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: MigrationReviewRecordStatus.REJECTED,
          rejectionReason: 'invalid document',
          reviewedBy: 42,
        })
      );
    });

    it('ควร throw NotFoundException เมื่อไม่เจอ item', async () => {
      migrationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.reject('not-exists', mockUser as User, 'reason')
      ).rejects.toThrow(NotFoundException);
    });
  });
});
