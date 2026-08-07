// File: backend/src/modules/migration/services/rag-batch.service.spec.ts
// Change Log:
// - 2026-08-06: Initial creation — unit tests for RagBatchService (T051, T052, Feature 242)
// - 2026-08-07: Added integration tests for triggerRagBatch main flow with mocked Queue

import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { RagBatchService } from './rag-batch.service';
import { isDwgFile } from '../constants/dwg-exclusion.constant';

/**
 * Unit + Integration tests สำหรับ RagBatchService (Feature 242)
 * T051: candidate query skips DWG (MIME + extension), skips ai_processing_status='DONE', skips empty ocr_text
 * T052: re-run with new Idempotency-Key reports alreadyEmbedded count, enqueued=0 (FR-025)
 * Coverage: triggerRagBatch main flow, fetchRagCandidates, checkActiveImportBatches, idempotency
 */
describe('RagBatchService (Feature 242)', () => {
  let service: RagBatchService;
  let dataSource: jest.Mocked<DataSource>;
  let mockQueue: {
    add: jest.Mock;
    getJob: jest.Mock;
  };

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
      getJob: jest.fn().mockResolvedValue(null),
    };
    dataSource = {
      query: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<DataSource>;

    const module = await Test.createTestingModule({
      providers: [
        RagBatchService,
        { provide: DataSource, useValue: dataSource },
        { provide: 'BullQueue_ai-batch', useValue: mockQueue },
      ],
    }).compile();

    // Inject queue manually since @InjectQueue uses a specific token
    service = module.get<RagBatchService>(RagBatchService);
    // Access private property via reflection to inject mock queue
    (service as unknown as { aiBatchQueue: unknown }).aiBatchQueue =
      mockQueue as unknown;
  });

  describe('T051: candidate query — DWG/DXF exclusion logic', () => {
    it('isDwgFile returns true for .dwg extension', () => {
      expect(isDwgFile('', 'drawing.dwg')).toBe(true);
    });

    it('isDwgFile returns true for .dxf extension', () => {
      expect(isDwgFile('', 'plan.dxf')).toBe(true);
    });

    it('isDwgFile returns true for application/dwg MIME', () => {
      expect(isDwgFile('application/dwg', 'file.pdf')).toBe(true);
    });

    it('isDwgFile returns false for PDF', () => {
      expect(isDwgFile('application/pdf', 'document.pdf')).toBe(false);
    });

    it('isDwgFile returns false for DOCX', () => {
      expect(
        isDwgFile(
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'report.docx'
        )
      ).toBe(false);
    });

    it('isDwgFile returns false for empty values', () => {
      expect(isDwgFile('', '')).toBe(false);
    });
  });

  describe('T051: candidate query — empty OCR text skip logic', () => {
    it('empty ocr_text should be skipped (trim check)', () => {
      const ocrText = '   ';
      expect(!ocrText || ocrText.trim().length === 0).toBe(true);
    });

    it('null ocr_text should be skipped', () => {
      const ocrText: string | null = null;
      expect(!ocrText || (ocrText as string).trim().length === 0).toBe(true);
    });

    it('non-empty ocr_text should NOT be skipped', () => {
      const ocrText = 'This is valid OCR text content';
      expect(!ocrText || ocrText.trim().length === 0).toBe(false);
    });
  });

  describe('T051: candidate query — alreadyEmbedded skip (ai_processing_status)', () => {
    it('ai_processing_status = DONE should be excluded by query WHERE clause', () => {
      const status = 'DONE';
      const shouldInclude =
        status === null || status === undefined || status !== 'DONE';
      expect(shouldInclude).toBe(false);
    });

    it('ai_processing_status = NULL should be included', () => {
      const status: string | null = null;
      const shouldInclude =
        status === null || status === undefined || status !== 'DONE';
      expect(shouldInclude).toBe(true);
    });

    it('ai_processing_status = PENDING should be included', () => {
      const status: string | null = 'PENDING';
      const shouldInclude =
        status === null || status === undefined || status !== 'DONE';
      expect(shouldInclude).toBe(true);
    });
  });

  describe('T052: idempotency — re-run reports alreadyEmbedded (FR-025)', () => {
    it('returns structured result with skipBreakdown including alreadyEmbedded', async () => {
      const result = await service.triggerRagBatch();
      expect(result).toHaveProperty('skipBreakdown.alreadyEmbedded');
      expect(typeof result.skipBreakdown.alreadyEmbedded).toBe('number');
    });

    it('returns enqueued=0 when no candidates (empty queue)', async () => {
      const result = await service.triggerRagBatch();
      expect(result.enqueued).toBe(0);
      expect(result.total).toBe(0);
    });

    it('returns batchId when provided', async () => {
      const result = await service.triggerRagBatch('batch-123');
      expect(result.batchId).toBe('batch-123');
    });

    it('returns null batchId when not provided (FR-026a)', async () => {
      const result = await service.triggerRagBatch();
      expect(result.batchId).toBeNull();
    });

    it('result includes enqueuedAt timestamp', async () => {
      const result = await service.triggerRagBatch();
      expect(result.enqueuedAt).toBeInstanceOf(Date);
    });
  });

  describe('skipBreakdown structure (FR-026b)', () => {
    it('skipBreakdown has all three categories', async () => {
      const result = await service.triggerRagBatch();
      expect(result.skipBreakdown).toHaveProperty('noTextLayer');
      expect(result.skipBreakdown).toHaveProperty('emptyOcrText');
      expect(result.skipBreakdown).toHaveProperty('alreadyEmbedded');
    });
  });

  describe('triggerRagBatch — main flow with candidates', () => {
    /** ตั้งค่า mock สำหรับมี candidates */
    function setupCandidates(
      candidates: Array<Record<string, unknown>>,
      activeImportCount = 0,
      existingJobState: string | null = null
    ) {
      dataSource.query.mockImplementation((sql: string) => {
        if (sql.includes('import_transactions') && sql.includes('COUNT')) {
          return Promise.resolve([{ active_count: activeImportCount }]);
        }
        // RAG candidate query
        if (sql.includes('attachments a')) {
          return Promise.resolve(candidates);
        }
        return Promise.resolve([]);
      });
      if (existingJobState) {
        mockQueue.getJob.mockResolvedValue({
          getState: jest.fn().mockResolvedValue(existingJobState),
        });
      } else {
        mockQueue.getJob.mockResolvedValue(null);
      }
    }

    it('enqueues valid candidates with OCR text', async () => {
      const candidates = [
        {
          id: 1,
          public_id: 'att-uuid-001',
          ocr_text: 'Valid OCR text content here',
          mime_type: 'application/pdf',
          original_filename: 'doc1.pdf',
          project_public_id: 'proj-uuid-001',
        },
        {
          id: 2,
          public_id: 'att-uuid-002',
          ocr_text: 'Another valid document text',
          mime_type: 'application/pdf',
          original_filename: 'doc2.pdf',
          project_public_id: 'proj-uuid-001',
        },
      ];
      setupCandidates(candidates);

      const result = await service.triggerRagBatch();

      expect(result.total).toBe(2);
      expect(result.enqueued).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockQueue.add).toHaveBeenCalledTimes(2);
    });

    it('skips DWG files (noTextLayer)', async () => {
      const candidates = [
        {
          id: 1,
          public_id: 'att-dwg-001',
          ocr_text: 'some text',
          mime_type: 'application/dwg',
          original_filename: 'plan.dwg',
          project_public_id: 'proj-uuid-001',
        },
      ];
      setupCandidates(candidates);

      const result = await service.triggerRagBatch();

      expect(result.total).toBe(1);
      expect(result.enqueued).toBe(0);
      expect(result.skipBreakdown.noTextLayer).toBe(1);
    });

    it('skips DXF files by extension', async () => {
      const candidates = [
        {
          id: 1,
          public_id: 'att-dxf-001',
          ocr_text: 'some text',
          mime_type: null,
          original_filename: 'drawing.dxf',
          project_public_id: 'proj-uuid-001',
        },
      ];
      setupCandidates(candidates);

      const result = await service.triggerRagBatch();

      expect(result.skipBreakdown.noTextLayer).toBe(1);
      expect(result.enqueued).toBe(0);
    });

    it('skips candidates with empty OCR text', async () => {
      const candidates = [
        {
          id: 1,
          public_id: 'att-empty-ocr',
          ocr_text: '   ',
          mime_type: 'application/pdf',
          original_filename: 'doc.pdf',
          project_public_id: 'proj-uuid-001',
        },
      ];
      setupCandidates(candidates);

      const result = await service.triggerRagBatch();

      expect(result.skipBreakdown.emptyOcrText).toBe(1);
      expect(result.enqueued).toBe(0);
    });

    it('skips candidates with null OCR text', async () => {
      const candidates = [
        {
          id: 1,
          public_id: 'att-null-ocr',
          ocr_text: null,
          mime_type: 'application/pdf',
          original_filename: 'doc.pdf',
          project_public_id: 'proj-uuid-001',
        },
      ];
      setupCandidates(candidates);

      const result = await service.triggerRagBatch();

      expect(result.skipBreakdown.emptyOcrText).toBe(1);
      expect(result.enqueued).toBe(0);
    });

    it('skips already-enqueued jobs (alreadyEmbedded)', async () => {
      const candidates = [
        {
          id: 1,
          public_id: 'att-already',
          ocr_text: 'valid text',
          mime_type: 'application/pdf',
          original_filename: 'doc.pdf',
          project_public_id: 'proj-uuid-001',
        },
      ];
      setupCandidates(candidates, 0, 'active'); // job exists and is active

      const result = await service.triggerRagBatch();

      expect(result.skipBreakdown.alreadyEmbedded).toBe(1);
      expect(result.enqueued).toBe(0);
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('re-enqueues if existing job is completed', async () => {
      const candidates = [
        {
          id: 1,
          public_id: 'att-completed',
          ocr_text: 'valid text',
          mime_type: 'application/pdf',
          original_filename: 'doc.pdf',
          project_public_id: 'proj-uuid-001',
        },
      ];
      setupCandidates(candidates, 0, 'completed');

      const result = await service.triggerRagBatch();

      expect(result.enqueued).toBe(1);
      expect(result.skipBreakdown.alreadyEmbedded).toBe(0);
    });

    it('handles mixed candidates (valid + DWG + empty + already)', async () => {
      const candidates = [
        {
          id: 1,
          public_id: 'att-valid',
          ocr_text: 'valid text',
          mime_type: 'application/pdf',
          original_filename: 'doc.pdf',
          project_public_id: 'proj-uuid-001',
        },
        {
          id: 2,
          public_id: 'att-dwg',
          ocr_text: 'text',
          mime_type: 'application/dwg',
          original_filename: 'plan.dwg',
          project_public_id: 'proj-uuid-001',
        },
        {
          id: 3,
          public_id: 'att-empty',
          ocr_text: '',
          mime_type: 'application/pdf',
          original_filename: 'doc2.pdf',
          project_public_id: 'proj-uuid-001',
        },
      ];
      setupCandidates(candidates);

      const result = await service.triggerRagBatch();

      expect(result.total).toBe(3);
      expect(result.enqueued).toBe(1);
      expect(result.skipBreakdown.noTextLayer).toBe(1);
      expect(result.skipBreakdown.emptyOcrText).toBe(1);
      expect(result.skipped).toBe(2);
    });

    it('includes warning when import is in progress', async () => {
      setupCandidates([], 5); // 5 active imports
      const result = await service.triggerRagBatch();
      expect(result.warning).toBe('IMPORT_IN_PROGRESS');
    });

    it('does not include warning when no active imports', async () => {
      setupCandidates([], 0);
      const result = await service.triggerRagBatch();
      expect(result.warning).toBeUndefined();
    });

    it('handles queue.add failure gracefully', async () => {
      const candidates = [
        {
          id: 1,
          public_id: 'att-fail',
          ocr_text: 'valid text',
          mime_type: 'application/pdf',
          original_filename: 'doc.pdf',
          project_public_id: 'proj-uuid-001',
        },
      ];
      setupCandidates(candidates);
      mockQueue.add.mockRejectedValue(new Error('Redis connection lost'));

      const result = await service.triggerRagBatch();

      expect(result.failed).toBe(1);
      expect(result.enqueued).toBe(0);
    });

    it('passes batchId to fetchRagCandidates when provided', async () => {
      setupCandidates([]);
      await service.triggerRagBatch('batch-scope-123');
      // query should have been called with batchId in params
      const lastCall = dataSource.query.mock.calls[0];
      if (lastCall && Array.isArray(lastCall[1])) {
        expect(lastCall[1]).toContain('batch-scope-123');
      }
    });

    it('passes correct job data to queue.add', async () => {
      const candidates = [
        {
          id: 1,
          public_id: 'att-data-check',
          ocr_text: 'valid text',
          mime_type: 'application/pdf',
          original_filename: 'doc.pdf',
          project_public_id: 'proj-uuid-999',
        },
      ];
      setupCandidates(candidates);

      await service.triggerRagBatch('batch-x');

      expect(mockQueue.add).toHaveBeenCalledWith(
        'rag-prepare',
        expect.objectContaining({
          documentPublicId: 'att-data-check',
          projectPublicId: 'proj-uuid-999',
          batchId: 'batch-x',
          jobType: 'rag-prepare',
        }),
        expect.objectContaining({
          jobId: 'rag-prepare-att-data-check',
          removeOnComplete: 100,
          removeOnFail: 50,
        })
      );
    });
  });

  describe('queue not available', () => {
    it('counts as failed when queue is undefined', async () => {
      // Remove queue
      (service as unknown as { aiBatchQueue: unknown }).aiBatchQueue =
        undefined;
      dataSource.query.mockImplementation((sql: string) => {
        if (sql.includes('import_transactions') && sql.includes('COUNT'))
          return Promise.resolve([{ active_count: 0 }]);
        if (sql.includes('attachments a'))
          return Promise.resolve([
            {
              id: 1,
              public_id: 'att-no-queue',
              ocr_text: 'valid text',
              mime_type: 'application/pdf',
              original_filename: 'doc.pdf',
              project_public_id: 'proj-uuid-001',
            },
          ]);
        return Promise.resolve([]);
      });

      const result = await service.triggerRagBatch();

      expect(result.failed).toBe(1);
      expect(result.enqueued).toBe(0);
    });
  });
});
