// File: backend/src/modules/ai/services/rag-citation.service.spec.ts
// Change Log:
// - 2026-09-10: เพิ่ม tests สำหรับ RagCitationService citation mapping (Feature 254, Phase 4 US2, T041)

import { Test, TestingModule } from '@nestjs/testing';
import { RagAttachmentChunk } from '../entities/rag-attachment-chunk.entity';
import { AiVectorSearchResult } from '../qdrant.service';
import { RagCitationService } from './rag-citation.service';

/**
 * Tests สำหรับ RagCitationService
 * - ตรวจสอบการแปลง raw chunks + scores เป็น citation objects
 * - ยืนยันว่า output ไม่มี generationUuid (user-safe)
 * - กรองตาม classification ของผู้ใช้
 */
describe('RagCitationService', () => {
  let service: RagCitationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RagCitationService],
    }).compile();
    service = module.get<RagCitationService>(RagCitationService);
  });

  /** Helper สร้าง chunk record จำลอง */
  const makeChunk = (
    overrides: Partial<RagAttachmentChunk> & {
      chunkPublicId: string;
    }
  ): RagAttachmentChunk =>
    ({
      chunkPublicId: overrides.chunkPublicId,
      attachmentUuid: overrides.attachmentUuid ?? 'att-1',
      ownerType: overrides.ownerType ?? 'CORRESPONDENCE',
      ownerPublicId: overrides.ownerPublicId ?? 'corr-1',
      content: overrides.content ?? 'sample content',
      classification: overrides.classification ?? 'INTERNAL',
      segmentNumber: overrides.segmentNumber,
      segmentLabel: overrides.segmentLabel,
      sourceLocator: overrides.sourceLocator,
    }) as RagAttachmentChunk;

  /** Helper สร้าง Qdrant result จำลอง */
  const makeResult = (
    chunkPublicId: string,
    score: number,
    generationUuid = 'gen-active'
  ): AiVectorSearchResult => ({
    pointId: `p-${chunkPublicId}`,
    score,
    payload: {
      chunk_public_id: chunkPublicId,
      generation_uuid: generationUuid,
    },
  });

  describe('mapToCitations', () => {
    it('maps active chunks into citations with score', () => {
      const chunkMap = new Map<string, RagAttachmentChunk>([
        ['chunk-1', makeChunk({ chunkPublicId: 'chunk-1', content: 'hello' })],
      ]);
      const rawResults = [makeResult('chunk-1', 0.95)];

      const { citations, skippedStale } = service.mapToCitations(
        rawResults,
        chunkMap,
        10
      );

      expect(citations).toHaveLength(1);
      expect(citations[0]).toMatchObject({
        chunkPublicId: 'chunk-1',
        attachmentPublicId: 'att-1',
        ownerType: 'CORRESPONDENCE',
        ownerPublicId: 'corr-1',
        content: 'hello',
        score: 0.95,
      });
      expect(skippedStale).toBe(0);
    });

    it('does not include generationUuid in citation output', () => {
      const chunkMap = new Map<string, RagAttachmentChunk>([
        ['chunk-1', makeChunk({ chunkPublicId: 'chunk-1' })],
      ]);
      const rawResults = [makeResult('chunk-1', 0.9, 'gen-active')];

      const { citations } = service.mapToCitations(rawResults, chunkMap, 10);

      expect(citations).toHaveLength(1);
      expect(citations[0]).not.toHaveProperty('generationUuid');
    });

    it('skips results whose chunk is missing from chunkMap', () => {
      const chunkMap = new Map<string, RagAttachmentChunk>();
      const rawResults = [makeResult('chunk-missing', 0.9)];

      const { citations, skippedStale } = service.mapToCitations(
        rawResults,
        chunkMap,
        10
      );

      expect(citations).toEqual([]);
      expect(skippedStale).toBe(1);
    });

    it('skips results with missing chunk_public_id payload', () => {
      const chunkMap = new Map<string, RagAttachmentChunk>([
        ['chunk-1', makeChunk({ chunkPublicId: 'chunk-1' })],
      ]);
      const rawResults: AiVectorSearchResult[] = [
        {
          pointId: 'p-orphan',
          score: 0.8,
          payload: { generation_uuid: 'gen-active' },
        },
      ];

      const { citations, skippedStale } = service.mapToCitations(
        rawResults,
        chunkMap,
        10
      );

      expect(citations).toEqual([]);
      expect(skippedStale).toBe(1);
    });

    it('filters out chunks by classification when allowedClassifications set', () => {
      const chunkMap = new Map<string, RagAttachmentChunk>([
        [
          'chunk-1',
          makeChunk({
            chunkPublicId: 'chunk-1',
            classification: 'CONFIDENTIAL',
          }),
        ],
      ]);
      const rawResults = [makeResult('chunk-1', 0.9)];

      const { citations, skippedStale } = service.mapToCitations(
        rawResults,
        chunkMap,
        10,
        ['PUBLIC', 'INTERNAL']
      );

      expect(citations).toEqual([]);
      expect(skippedStale).toBe(1);
    });

    it('keeps chunks whose classification is in allowed set', () => {
      const chunkMap = new Map<string, RagAttachmentChunk>([
        [
          'chunk-1',
          makeChunk({ chunkPublicId: 'chunk-1', classification: 'INTERNAL' }),
        ],
      ]);
      const rawResults = [makeResult('chunk-1', 0.9)];

      const { citations } = service.mapToCitations(rawResults, chunkMap, 10, [
        'PUBLIC',
        'INTERNAL',
      ]);

      expect(citations).toHaveLength(1);
    });

    it('respects topK limit', () => {
      const chunkMap = new Map<string, RagAttachmentChunk>([
        ['chunk-1', makeChunk({ chunkPublicId: 'chunk-1' })],
        ['chunk-2', makeChunk({ chunkPublicId: 'chunk-2' })],
        ['chunk-3', makeChunk({ chunkPublicId: 'chunk-3' })],
      ]);
      const rawResults = [
        makeResult('chunk-1', 0.95),
        makeResult('chunk-2', 0.9),
        makeResult('chunk-3', 0.85),
      ];

      const { citations } = service.mapToCitations(rawResults, chunkMap, 2);

      expect(citations).toHaveLength(2);
      expect(citations[0].chunkPublicId).toBe('chunk-1');
      expect(citations[1].chunkPublicId).toBe('chunk-2');
    });

    it('preserves optional segment fields when present', () => {
      const chunkMap = new Map<string, RagAttachmentChunk>([
        [
          'chunk-1',
          makeChunk({
            chunkPublicId: 'chunk-1',
            segmentNumber: 3,
            segmentLabel: 'page-3',
            sourceLocator: 'loc-1',
          }),
        ],
      ]);
      const rawResults = [makeResult('chunk-1', 0.9)];

      const { citations } = service.mapToCitations(rawResults, chunkMap, 10);

      expect(citations[0]).toMatchObject({
        segmentNumber: 3,
        segmentLabel: 'page-3',
        sourceLocator: 'loc-1',
      });
    });

    it('returns empty citations for empty input', () => {
      const { citations, skippedStale } = service.mapToCitations(
        [],
        new Map(),
        10
      );

      expect(citations).toEqual([]);
      expect(skippedStale).toBe(0);
    });
  });
});
