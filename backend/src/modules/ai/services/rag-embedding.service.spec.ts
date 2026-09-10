// File: backend/src/modules/ai/services/rag-embedding.service.spec.ts
// Change Log:
// - 2026-09-10: T028 เพิ่ม tests สำหรับ RagEmbeddingService — BGE-M3 dense+sparse embedding และ Qdrant payload (Feature 254)

import { Test, TestingModule } from '@nestjs/testing';
import { RagEmbeddingService } from './rag-embedding.service';
import { OcrService } from './ocr.service';
import type { RagChunkDraft } from './rag-chunking.service';

describe('RagEmbeddingService', () => {
  let service: RagEmbeddingService;
  const ocrService = {
    embedViaSidecar: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagEmbeddingService,
        { provide: OcrService, useValue: ocrService },
      ],
    }).compile();
    service = module.get<RagEmbeddingService>(RagEmbeddingService);
  });

  it('embeds chunk content via OcrService sidecar', async () => {
    const fakeEmbed = {
      dense: [0.1, 0.2, 0.3],
      sparse: { indices: [1, 5, 9], values: [0.4, 0.5, 0.6] },
      device: 'gpu',
    };
    ocrService.embedViaSidecar.mockResolvedValue(fakeEmbed);

    const result = await service.embedChunk('sample text');

    expect(ocrService.embedViaSidecar).toHaveBeenCalledWith('sample text');
    expect(result.dense).toEqual([0.1, 0.2, 0.3]);
    expect(result.sparse.indices).toEqual([1, 5, 9]);
    expect(result.sparse.values).toEqual([0.4, 0.5, 0.6]);
    expect(result.device).toBe('gpu');
  });

  it('builds Qdrant point with correct payload fields', () => {
    const draft: RagChunkDraft = {
      chunkPublicId: 'chunk-uuid-1',
      chunkIndex: 2,
      content: 'chunk content',
      sourcePageUuid: 'page-uuid-1',
      segmentType: 'PAGE',
      segmentNumber: 5,
      segmentLabel: 'Page 5',
      sourceLocator: 'doc.pdf#page=5',
      startOffset: 100,
      endOffset: 200,
    };
    const embedResult = {
      dense: [0.1, 0.2],
      sparse: { indices: [1], values: [0.9] },
    };
    const context = {
      generationUuid: 'gen-uuid-1',
      attachmentPublicId: 'att-uuid-1',
      ownerType: 'CORRESPONDENCE',
      ownerPublicId: 'corr-uuid-1',
      projectPublicId: 'proj-uuid-1',
      classification: 'INTERNAL',
    };

    const point = service.buildQdrantPoint(draft, embedResult, context);

    expect(point.id).toBe('chunk-uuid-1');
    expect(point.vector.bge_dense).toEqual([0.1, 0.2]);
    expect(point.vector.bge_sparse.indices).toEqual([1]);
    expect(point.vector.bge_sparse.values).toEqual([0.9]);
    expect(point.payload).toMatchObject({
      chunk_public_id: 'chunk-uuid-1',
      generation_uuid: 'gen-uuid-1',
      attachment_public_id: 'att-uuid-1',
      owner_type: 'CORRESPONDENCE',
      owner_public_id: 'corr-uuid-1',
      project_public_id: 'proj-uuid-1',
      chunk_index: 2,
      classification: 'INTERNAL',
      segment_type: 'PAGE',
      segment_number: 5,
      source_locator: 'doc.pdf#page=5',
      start_offset: 100,
      end_offset: 200,
    });
  });

  it('handles null segment metadata in Qdrant payload', () => {
    const draft: RagChunkDraft = {
      chunkPublicId: 'chunk-uuid-2',
      chunkIndex: 0,
      content: 'whole doc',
      sourcePageUuid: 'page-uuid-2',
      segmentType: 'WHOLE_DOCUMENT',
      startOffset: 0,
      endOffset: 9,
    };
    const embedResult = {
      dense: [0.5],
      sparse: { indices: [2], values: [0.3] },
    };
    const context = {
      generationUuid: 'gen-uuid-2',
      attachmentPublicId: 'att-uuid-2',
      ownerType: 'CORRESPONDENCE',
      ownerPublicId: 'corr-uuid-2',
      projectPublicId: 'proj-uuid-2',
      classification: 'PUBLIC',
    };

    const point = service.buildQdrantPoint(draft, embedResult, context);

    expect(point.payload['segment_number']).toBeNull();
    expect(point.payload['source_locator']).toBeNull();
  });

  it('embeds and builds point in a single call', async () => {
    const draft: RagChunkDraft = {
      chunkPublicId: 'chunk-uuid-3',
      chunkIndex: 0,
      content: 'test content',
      sourcePageUuid: 'page-uuid-3',
      segmentType: 'WHOLE_DOCUMENT',
      startOffset: 0,
      endOffset: 12,
    };
    const context = {
      generationUuid: 'gen-uuid-3',
      attachmentPublicId: 'att-uuid-3',
      ownerType: 'CORRESPONDENCE',
      ownerPublicId: 'corr-uuid-3',
      projectPublicId: 'proj-uuid-3',
      classification: 'CONFIDENTIAL',
    };
    ocrService.embedViaSidecar.mockResolvedValue({
      dense: [0.7],
      sparse: { indices: [0], values: [1.0] },
    });

    const point = await service.embedAndBuildPoint(draft, context);

    expect(ocrService.embedViaSidecar).toHaveBeenCalledWith('test content');
    expect(point.id).toBe('chunk-uuid-3');
    expect(point.vector.bge_dense).toEqual([0.7]);
    expect(point.payload['classification']).toBe('CONFIDENTIAL');
  });
});
