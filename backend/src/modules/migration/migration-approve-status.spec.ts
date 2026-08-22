// File: backend/src/modules/migration/migration-approve-status.spec.ts
// Change Log:
// - 2026-08-22: Added regression coverage for approve-and-import queue status

import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { FileStorageService } from '../../common/file-storage/file-storage.service';
import { CorrespondenceStatus } from '../correspondence/entities/correspondence-status.entity';
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import { Project } from '../project/entities/project.entity';
import { ImportCorrespondenceDto } from './dto/import-correspondence.dto';
import { ImportTransaction } from './entities/import-transaction.entity';
import { MigrationError } from './entities/migration-error.entity';
import {
  MigrationReviewQueue,
  MigrationReviewStatus,
} from './entities/migration-review-queue.entity';
import { MigrationService } from './migration.service';

describe('MigrationService approve-and-import status', () => {
  let service: MigrationService;

  const reviewQueueRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const importDto = {
    documentNumber: 'QC-0001',
    subject: 'Quality control document',
    category: 'Correspondence',
    migratedBy: 'SYSTEM_IMPORT',
    batchId: 'MANUAL_REVIEW_BATCH',
    projectId: 1,
  } as ImportCorrespondenceDto;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MigrationService,
        {
          provide: DataSource,
          useValue: { manager: { find: jest.fn() } },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
        {
          provide: getRepositoryToken(ImportTransaction),
          useValue: {},
        },
        {
          provide: getRepositoryToken(CorrespondenceType),
          useValue: {},
        },
        {
          provide: getRepositoryToken(CorrespondenceStatus),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Project),
          useValue: {},
        },
        {
          provide: getRepositoryToken(MigrationReviewQueue),
          useValue: reviewQueueRepo,
        },
        {
          provide: getRepositoryToken(MigrationError),
          useValue: {},
        },
        {
          provide: FileStorageService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<MigrationService>(MigrationService);
  });

  const mockSuccessfulImport = (): void => {
    jest.spyOn(service, 'importCorrespondence').mockResolvedValue({
      message: 'Import successful',
      correspondenceId: 10,
      revisionId: 20,
      transactionId: 30,
      hasAttachment: true,
    });
  };

  const createPendingQueueItem = (): MigrationReviewQueue =>
    ({
      id: 1,
      publicId: '01a027e4-b212-74fa-a47d-51fe6aeb0f0c',
      status: MigrationReviewStatus.PENDING,
      ocrText: 'existing OCR text',
    }) as MigrationReviewQueue;

  it('marks the publicId queue item as IMPORTED after a successful import', async () => {
    const queueItem = createPendingQueueItem();
    reviewQueueRepo.findOne.mockResolvedValue(queueItem);
    mockSuccessfulImport();

    await service.approveQueueItemByPublicId(
      queueItem.publicId,
      importDto,
      'review-import-key',
      1
    );

    expect(queueItem.status).toBe(MigrationReviewStatus.IMPORTED);
    expect(reviewQueueRepo.save).toHaveBeenCalledWith(queueItem);
  });

  it('marks the internal-id queue item as IMPORTED after a successful import', async () => {
    const queueItem = createPendingQueueItem();
    reviewQueueRepo.findOne.mockResolvedValue(queueItem);
    mockSuccessfulImport();

    await service.approveQueueItem(
      queueItem.id,
      importDto,
      'review-import-key',
      1
    );

    expect(queueItem.status).toBe(MigrationReviewStatus.IMPORTED);
    expect(reviewQueueRepo.save).toHaveBeenCalledWith(queueItem);
  });
});
