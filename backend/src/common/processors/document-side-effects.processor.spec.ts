// File: backend/src/common/processors/document-side-effects.processor.spec.ts
// Change Log:
// - 2026-09-09: Initial creation. Regression coverage for the DOCUMENT_SIDE_EFFECTS_QUEUE
//   having zero processor (jobs enqueued by DocumentSideEffectsService.executeNonCritical()
//   sat unconsumed in Redis forever). See document-side-effects.processor.ts change log.

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { DocumentSideEffectsProcessor } from './document-side-effects.processor';
import { SideEffectJobType } from '../services/document-side-effects.service';
import { SearchService } from '../../modules/search/search.service';
import { AiQdrantService } from '../../modules/ai/qdrant.service';
import { NotificationService } from '../../modules/notification/notification.service';
import { Correspondence } from '../../modules/correspondence/entities/correspondence.entity';
import { CorrespondenceRevision } from '../../modules/correspondence/entities/correspondence-revision.entity';

function makeJob(name: string, data: unknown): Job {
  return { name, data } as unknown as Job;
}

describe('DocumentSideEffectsProcessor', () => {
  let processor: DocumentSideEffectsProcessor;
  let mockSearchService: { indexDocument: jest.Mock };
  let mockQdrantService: { deleteByDocumentPublicId: jest.Mock };
  let mockNotificationService: { send: jest.Mock };
  let mockCorrespondenceRepo: { findOne: jest.Mock };
  let mockRevisionRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    mockSearchService = {
      indexDocument: jest.fn().mockResolvedValue(undefined),
    };
    mockQdrantService = {
      deleteByDocumentPublicId: jest.fn().mockResolvedValue(undefined),
    };
    mockNotificationService = { send: jest.fn().mockResolvedValue(undefined) };
    mockCorrespondenceRepo = { findOne: jest.fn() };
    mockRevisionRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentSideEffectsProcessor,
        { provide: SearchService, useValue: mockSearchService },
        { provide: AiQdrantService, useValue: mockQdrantService },
        { provide: NotificationService, useValue: mockNotificationService },
        {
          provide: getRepositoryToken(Correspondence),
          useValue: mockCorrespondenceRepo,
        },
        {
          provide: getRepositoryToken(CorrespondenceRevision),
          useValue: mockRevisionRepo,
        },
      ],
    }).compile();

    processor = module.get<DocumentSideEffectsProcessor>(
      DocumentSideEffectsProcessor
    );
  });

  describe('SEARCH_REINDEX', () => {
    it('reindexes a correspondence using its current revision', async () => {
      mockCorrespondenceRepo.findOne.mockResolvedValue({
        id: 5,
        publicId: 'corr-uuid-1',
        correspondenceNumber: 'LTR-001',
        projectId: 3,
        createdAt: new Date('2026-01-01'),
      });
      mockRevisionRepo.findOne.mockResolvedValue({
        subject: 'Updated Subject',
        description: 'desc',
        status: { statusCode: 'SUBOWN' },
      });

      await processor.process(
        makeJob(SideEffectJobType.SEARCH_REINDEX, {
          documentType: 'CORRESPONDENCE',
          publicId: 'corr-uuid-1',
          auditId: 'audit-1',
        })
      );

      expect(mockSearchService.indexDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 5,
          publicId: 'corr-uuid-1',
          type: 'correspondence',
          docNumber: 'LTR-001',
          title: 'Updated Subject',
          status: 'SUBOWN',
        })
      );
    });

    it('falls back to correspondenceNumber as title when no current revision exists', async () => {
      mockCorrespondenceRepo.findOne.mockResolvedValue({
        id: 5,
        publicId: 'corr-uuid-1',
        correspondenceNumber: 'LTR-001',
        projectId: 3,
        createdAt: new Date(),
      });
      mockRevisionRepo.findOne.mockResolvedValue(null);

      await processor.process(
        makeJob(SideEffectJobType.SEARCH_REINDEX, {
          documentType: 'CORRESPONDENCE',
          publicId: 'corr-uuid-1',
          auditId: 'audit-1',
        })
      );

      expect(mockSearchService.indexDocument).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'LTR-001' })
      );
    });

    it('does nothing when the correspondence no longer exists', async () => {
      mockCorrespondenceRepo.findOne.mockResolvedValue(null);

      await processor.process(
        makeJob(SideEffectJobType.SEARCH_REINDEX, {
          documentType: 'CORRESPONDENCE',
          publicId: 'missing',
          auditId: 'audit-1',
        })
      );

      expect(mockSearchService.indexDocument).not.toHaveBeenCalled();
    });

    it('skips (does not throw) for a documentType with no real caller/implementation', async () => {
      await expect(
        processor.process(
          makeJob(SideEffectJobType.SEARCH_REINDEX, {
            documentType: 'RFA',
            publicId: 'rfa-uuid-1',
            auditId: 'audit-1',
          })
        )
      ).resolves.not.toThrow();
      expect(mockSearchService.indexDocument).not.toHaveBeenCalled();
      expect(mockCorrespondenceRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('NOTIFICATION', () => {
    it('notifies the acting user', async () => {
      await processor.process(
        makeJob(SideEffectJobType.NOTIFICATION, {
          documentType: 'CORRESPONDENCE',
          publicId: 'corr-uuid-1',
          userId: '7',
          auditId: 'audit-1',
        })
      );

      expect(mockNotificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 7, type: 'SYSTEM' })
      );
    });

    it('skips when userId is not a valid number', async () => {
      await processor.process(
        makeJob(SideEffectJobType.NOTIFICATION, {
          documentType: 'CORRESPONDENCE',
          publicId: 'corr-uuid-1',
          userId: 'not-a-number',
          auditId: 'audit-1',
        })
      );

      expect(mockNotificationService.send).not.toHaveBeenCalled();
    });
  });

  describe('VECTOR_DELETE', () => {
    it('deletes vectors by document public id', async () => {
      await processor.process(
        makeJob(SideEffectJobType.VECTOR_DELETE, {
          documentType: 'CORRESPONDENCE',
          publicId: 'corr-uuid-1',
          projectPublicId: 'proj-uuid-1',
          auditId: 'audit-1',
        })
      );

      expect(mockQdrantService.deleteByDocumentPublicId).toHaveBeenCalledWith(
        'proj-uuid-1',
        'corr-uuid-1'
      );
    });

    it('skips when projectPublicId is missing', async () => {
      await processor.process(
        makeJob(SideEffectJobType.VECTOR_DELETE, {
          documentType: 'CORRESPONDENCE',
          publicId: 'corr-uuid-1',
          projectPublicId: '',
          auditId: 'audit-1',
        })
      );

      expect(mockQdrantService.deleteByDocumentPublicId).not.toHaveBeenCalled();
    });
  });

  it('logs a warning and does not throw for an unknown job name', async () => {
    await expect(
      processor.process(makeJob('unknown-job-type', {}))
    ).resolves.not.toThrow();
  });
});
