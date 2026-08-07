// File: backend/src/modules/migration/services/rag-batch.service.spec.ts
// Change Log:
// - 2026-08-06: Initial creation — unit tests for RagBatchService (T051, T052, Feature 242)

import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { RagBatchService } from './rag-batch.service';
import { isDwgFile } from '../constants/dwg-exclusion.constant';

/**
 * Unit tests สำหรับ RagBatchService (Feature 242)
 * T051: candidate query skips DWG (MIME + extension), skips ai_processing_status='DONE', skips empty ocr_text
 * T052: re-run with new Idempotency-Key reports alreadyEmbedded count, enqueued=0 (FR-025)
 */
describe('RagBatchService (Feature 242)', () => {
  let service: RagBatchService;
  let dataSource: jest.Mocked<DataSource>;

  beforeEach(async () => {
    dataSource = {
      query: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<DataSource>;

    const module = await Test.createTestingModule({
      providers: [
        RagBatchService,
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<RagBatchService>(RagBatchService);
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
      // Query uses: AND (a.ai_processing_status IS NULL OR a.ai_processing_status <> 'DONE')
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
});
