// File: backend/src/common/services/document-side-effects.service.spec.ts
// Change Log:
// - 2026-09-07: Unit tests สำหรับ DocumentSideEffectsService (Feature 253 — T035)

import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { QueryRunner } from 'typeorm';
import {
  DocumentSideEffectsService,
  DOCUMENT_SIDE_EFFECTS_QUEUE,
  SideEffectJobType,
} from './document-side-effects.service';

type JobCall = [
  string,
  Record<string, unknown>,
  { attempts: number; backoff: { type: string }; removeOnFail: boolean },
];

describe('DocumentSideEffectsService', () => {
  let service: DocumentSideEffectsService;
  let mockQueue: { add: jest.Mock<Promise<unknown>, JobCall> };

  const mockQueryRunner = {} as QueryRunner;

  beforeEach(async () => {
    mockQueue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentSideEffectsService,
        {
          provide: getQueueToken(DOCUMENT_SIDE_EFFECTS_QUEUE),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<DocumentSideEffectsService>(
      DocumentSideEffectsService
    );
  });

  describe('executeCritical', () => {
    it('should run terminateWorkflow and forceCloseCirculations callbacks', async () => {
      const terminateWorkflow = jest.fn().mockResolvedValue(undefined);
      const forceCloseCirculations = jest.fn().mockResolvedValue(2);

      const outcome = await service.executeCritical({
        publicId: 'corr-uuid-1',
        documentType: 'CORRESPONDENCE',
        userId: '1',
        queryRunner: mockQueryRunner,
        terminateWorkflow,
        forceCloseCirculations,
      });

      expect(terminateWorkflow).toHaveBeenCalledWith(mockQueryRunner);
      expect(forceCloseCirculations).toHaveBeenCalledWith(mockQueryRunner);
      expect(outcome.workflowTerminated).toBe(true);
      expect(outcome.circulationsClosed).toBe(2);
    });

    it('should return defaults when no callbacks provided', async () => {
      const outcome = await service.executeCritical({
        publicId: 'rfa-uuid-1',
        documentType: 'RFA',
        userId: '1',
        queryRunner: mockQueryRunner,
      });

      expect(outcome.workflowTerminated).toBe(false);
      expect(outcome.circulationsClosed).toBe(0);
    });

    it('should rethrow when terminateWorkflow fails (critical → rollback)', async () => {
      const terminateWorkflow = jest
        .fn()
        .mockRejectedValue(new Error('workflow engine down'));
      const forceCloseCirculations = jest.fn();

      await expect(
        service.executeCritical({
          publicId: 'corr-uuid-1',
          documentType: 'CORRESPONDENCE',
          userId: '1',
          queryRunner: mockQueryRunner,
          terminateWorkflow,
          forceCloseCirculations,
        })
      ).rejects.toThrow('workflow engine down');

      // force-close ไม่ควรถูกเรียกหลัง workflow fail
      expect(forceCloseCirculations).not.toHaveBeenCalled();
    });

    it('should rethrow when forceCloseCirculations fails (critical → rollback)', async () => {
      const forceCloseCirculations = jest
        .fn()
        .mockRejectedValue(new Error('deadlock'));

      await expect(
        service.executeCritical({
          publicId: 'corr-uuid-1',
          documentType: 'CORRESPONDENCE',
          userId: '1',
          queryRunner: mockQueryRunner,
          forceCloseCirculations,
        })
      ).rejects.toThrow('deadlock');
    });
  });

  describe('executeNonCritical', () => {
    it('should enqueue SEARCH_REINDEX + NOTIFICATION jobs', async () => {
      await service.executeNonCritical({
        publicId: 'corr-uuid-1',
        documentType: 'CORRESPONDENCE',
        userId: '1',
        auditId: 'audit-1',
      });

      const jobNames = mockQueue.add.mock.calls.map((c) => c[0]);
      expect(jobNames).toContain(SideEffectJobType.SEARCH_REINDEX);
      expect(jobNames).toContain(SideEffectJobType.NOTIFICATION);
      expect(mockQueue.add).toHaveBeenCalledTimes(2);
    });

    it('should enqueue VECTOR_DELETE job when projectPublicId provided', async () => {
      await service.executeNonCritical({
        publicId: 'corr-uuid-1',
        documentType: 'CORRESPONDENCE',
        userId: '1',
        auditId: 'audit-1',
        projectPublicId: 'proj-uuid-1',
      });

      const jobNames = mockQueue.add.mock.calls.map((c) => c[0]);
      expect(jobNames).toContain(SideEffectJobType.VECTOR_DELETE);
      expect(mockQueue.add).toHaveBeenCalledTimes(3);
    });

    it('should not enqueue VECTOR_DELETE when projectPublicId missing', async () => {
      await service.executeNonCritical({
        publicId: 'corr-uuid-1',
        documentType: 'CORRESPONDENCE',
        userId: '1',
        auditId: 'audit-1',
      });

      const jobNames = mockQueue.add.mock.calls.map((c) => c[0]);
      expect(jobNames).not.toContain(SideEffectJobType.VECTOR_DELETE);
    });

    it('should pass retry options (3 attempts + exponential backoff)', async () => {
      await service.executeNonCritical({
        publicId: 'corr-uuid-1',
        documentType: 'CORRESPONDENCE',
        userId: '1',
        auditId: 'audit-1',
      });

      const options = mockQueue.add.mock.calls[0][2];
      expect(options.attempts).toBe(3);
      expect(options.backoff.type).toBe('exponential');
      expect(options.removeOnFail).toBe(false);
    });

    it('should not throw when queue.add fails (non-critical)', async () => {
      mockQueue.add.mockRejectedValue(new Error('redis down'));

      await expect(
        service.executeNonCritical({
          publicId: 'corr-uuid-1',
          documentType: 'CORRESPONDENCE',
          userId: '1',
          auditId: 'audit-1',
        })
      ).resolves.toBeUndefined();
    });
  });
});

describe('DocumentSideEffectsService (no queue)', () => {
  it('should skip non-critical effects gracefully when queue unavailable', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DocumentSideEffectsService],
    }).compile();

    const svc = module.get<DocumentSideEffectsService>(
      DocumentSideEffectsService
    );

    await expect(
      svc.executeNonCritical({
        publicId: 'corr-uuid-1',
        documentType: 'CORRESPONDENCE',
        userId: '1',
        auditId: 'audit-1',
      })
    ).resolves.toBeUndefined();
  });
});
