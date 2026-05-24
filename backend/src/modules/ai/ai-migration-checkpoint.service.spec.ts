// File: src/modules/ai/ai-migration-checkpoint.service.spec.ts
// Change Log
// - 2026-05-24: เพิ่ม regression tests สำหรับ migration error enum normalization และ job_id logging.

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AiMigrationCheckpointService } from './ai-migration-checkpoint.service';
import { MigrationProgress } from './entities/migration-progress.entity';
import { MigrationReviewRecord } from './entities/migration-review.entity';

describe('AiMigrationCheckpointService', () => {
  const mockProgressRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const mockReviewRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const mockDataSource = {
    query: jest.fn(),
    manager: {
      query: jest.fn(),
    },
  };

  let service: AiMigrationCheckpointService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDataSource.query.mockResolvedValue([{ insertId: 99 }]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiMigrationCheckpointService,
        {
          provide: getRepositoryToken(MigrationProgress),
          useValue: mockProgressRepo,
        },
        {
          provide: getRepositoryToken(MigrationReviewRecord),
          useValue: mockReviewRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();
    service = module.get(AiMigrationCheckpointService);
  });

  it('ควร map AI_JOB_FAILED เป็น API_ERROR และบันทึก job_id', async () => {
    await expect(
      service.logError({
        batchId: 'C22024-MIGRATION',
        documentNumber: 'LCB-RFA-001',
        errorType: 'AI_JOB_FAILED',
        errorMessage: 'AI job failed',
        jobId: 'job-123',
      })
    ).resolves.toEqual({ id: 99 });

    expect(mockDataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('job_id'),
      [
        'C22024-MIGRATION',
        'LCB-RFA-001',
        'API_ERROR',
        'AI job failed',
        'job-123',
      ]
    );
  });

  it('ควร fallback เป็น UNKNOWN เมื่อ workflow ส่ง error_type ที่ enum ไม่รองรับ', async () => {
    await service.logError({
      batchId: 'C22024-MIGRATION',
      documentNumber: 'WORKFLOW',
      errorType: 'UNSUPPORTED_ERROR',
      errorMessage: 'unexpected',
    });

    expect(mockDataSource.query).toHaveBeenCalledWith(expect.any(String), [
      'C22024-MIGRATION',
      'WORKFLOW',
      'UNKNOWN',
      'unexpected',
      null,
    ]);
  });
});
