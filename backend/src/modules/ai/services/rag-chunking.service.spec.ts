// File: backend/src/modules/ai/services/rag-chunking.service.spec.ts
// Change Log:
// - 2026-09-10: T026 เพิ่ม tests สำหรับ RagChunkingService ที่ extract จาก RagSegmentationService (Feature 254)

import { ConfigService } from '@nestjs/config';
import { RagChunkingService } from './rag-chunking.service';

describe('RagChunkingService', () => {
  const configService = {
    get: jest.fn((key: string, fallback: number) => {
      if (key === 'EMBEDDING_CHUNK_SIZE') return 10;
      if (key === 'EMBEDDING_CHUNK_OVERLAP') return 3;
      return fallback;
    }),
  } as unknown as ConfigService;
  const service = new RagChunkingService(configService);

  it('splits text into chunks with correct overlap', () => {
    const segment = {
      segmentType: 'WHOLE_DOCUMENT' as const,
      text: 'abcdefghijklmnopqrstuvwxyz',
    };
    const pageUuid = 'page-uuid-1';
    const chunks = service.chunkSegment(segment, pageUuid);

    // chunkSize=10, overlap=3 → step=7
    // chunk 0: [0,10) = "abcdefghij"
    // chunk 1: [7,17) = "hijklmnopq"
    // chunk 2: [14,24) = "opqrstuvwx"
    // chunk 3: [21,26) = "vwxyz"
    expect(chunks).toHaveLength(4);
    expect(chunks[0].content).toBe('abcdefghij');
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].sourcePageUuid).toBe(pageUuid);
    expect(chunks[1].content).toBe('hijklmnopq');
    expect(chunks[1].chunkIndex).toBe(1);
    expect(chunks[3].content).toBe('vwxyz');
  });

  it('returns empty array for empty text', () => {
    const segment = { segmentType: 'WHOLE_DOCUMENT' as const, text: '' };
    const chunks = service.chunkSegment(segment, 'page-1');
    expect(chunks).toEqual([]);
  });

  it('produces a single chunk when text is shorter than chunk size', () => {
    const segment = { segmentType: 'WHOLE_DOCUMENT' as const, text: 'short' };
    const chunks = service.chunkSegment(segment, 'page-1');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('short');
    expect(chunks[0].startOffset).toBe(0);
    expect(chunks[0].endOffset).toBe(5);
  });

  it('assigns unique UUIDv7 chunk public IDs', () => {
    const segment = {
      segmentType: 'WHOLE_DOCUMENT' as const,
      text: 'abcdefghijklmnopqrstuvwxyz',
    };
    const chunks = service.chunkSegment(segment, 'page-1');
    const ids = chunks.map((c) => c.chunkPublicId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('preserves segment metadata in chunk drafts', () => {
    const segment = {
      segmentType: 'PAGE' as const,
      segmentNumber: 5,
      segmentLabel: 'Page 5',
      sourceLocator: 'doc.pdf#page=5',
      text: 'abcdefghijklmnopqrstuvwxyz',
    };
    const chunks = service.chunkSegment(segment, 'page-uuid-5');

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].segmentType).toBe('PAGE');
    expect(chunks[0].segmentNumber).toBe(5);
    expect(chunks[0].segmentLabel).toBe('Page 5');
    expect(chunks[0].sourceLocator).toBe('doc.pdf#page=5');
    expect(chunks[0].sourcePageUuid).toBe('page-uuid-5');
  });
});
