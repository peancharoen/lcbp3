// File: backend/src/modules/ai/processors/rag-attachment-ingest.processor.spec.ts
// Change Log:
// - 2026-09-10: เพิ่ม unit tests สำหรับ RAG ingest processor pipeline (Feature 254 coverage gap)

import { RagAttachmentIngestProcessor } from './rag-attachment-ingest.processor';
import type { Job } from 'bullmq';
import type { RagTextSegment } from '../interfaces/rag-attachment.types';
import type { RagChunkDraft } from '../services/rag-chunking.service';
import type { RagAttachmentIngestJobPayload } from '../ai-queue.service';

describe('RagAttachmentIngestProcessor', () => {
  let processor: RagAttachmentIngestProcessor;

  const generationRepository = {
    findOne: jest.fn(),
  };
  const attachmentRepository = {
    findOne: jest.fn(),
  };
  const pageRepository = {
    create: jest.fn((v: unknown) => v),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const chunkRepository = {
    create: jest.fn((v: unknown) => v),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const ingestionService = {
    markFailed: jest.fn().mockResolvedValue(undefined),
    markVerified: jest.fn().mockResolvedValue(undefined),
    activate: jest.fn().mockResolvedValue(undefined),
  };
  const textSegmentService = {
    normalizeWholeDocument: jest.fn(),
    normalizeSection: jest.fn(),
  };
  const chunkingService = {
    chunkSegment: jest.fn(),
  };
  const attachmentSourceService = {
    resolveFromAttachment: jest.fn(),
  };
  const embeddingService = {
    embedChunk: jest.fn(),
    buildQdrantPoint: jest.fn(),
  };
  const qdrantService = {
    upsert: jest.fn().mockResolvedValue(undefined),
  };

  const mockSegment: RagTextSegment = {
    segmentType: 'WHOLE_DOCUMENT',
    segmentNumber: 1,
    segmentLabel: 'Whole',
    text: 'sample text for chunking',
    sourceLocator: undefined,
  };

  const mockDraft: RagChunkDraft = {
    chunkPublicId: '019505a1-7c3e-7000-8000-abc123def456',
    chunkIndex: 0,
    content: 'sample text',
    sourcePageUuid: '019505a2-7c3e-7000-8000-abc123def456',
    segmentType: 'WHOLE_DOCUMENT',
    segmentNumber: 1,
    segmentLabel: 'Whole',
    sourceLocator: undefined,
    startOffset: 0,
    endOffset: 11,
  };

  const mockEmbedResult = {
    dense: [0.1, 0.2],
    sparse: { indices: [0, 1], values: [0.5, 0.6] },
    device: 'cpu',
  };

  const mockOwnerContext = {
    ownerType: 'CORRESPONDENCE',
    ownerPublicId: '019505a3-7c3e-7000-8000-abc123def456',
    projectPublicId: '019505a4-7c3e-7000-8000-abc123def456',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new RagAttachmentIngestProcessor(
      attachmentRepository as never,
      generationRepository as never,
      pageRepository as never,
      chunkRepository as never,
      ingestionService as never,
      textSegmentService as never,
      chunkingService as never,
      attachmentSourceService as never,
      embeddingService as never,
      qdrantService as never
    );
  });

  /** Helper สำหรับสร้าง BullMQ Job mock */
  function makeJob(
    data: RagAttachmentIngestJobPayload
  ): Job<RagAttachmentIngestJobPayload> {
    return { data } as unknown as Job<RagAttachmentIngestJobPayload>;
  }

  it('skips processing when no BUILDING generation is found', async () => {
    generationRepository.findOne.mockResolvedValue(null);

    await processor.process(
      makeJob({
        attachmentPublicId: 'att-1',
        attachmentChecksum: 'a'.repeat(64),
        force: false,
      })
    );

    expect(ingestionService.markFailed).not.toHaveBeenCalled();
    expect(chunkRepository.save).not.toHaveBeenCalled();
  });

  it('marks FAILED when attachment is not found', async () => {
    generationRepository.findOne.mockResolvedValue({
      generationUuid: 'gen-1',
      attachmentUuid: 'att-1',
      status: 'BUILDING',
    });
    attachmentRepository.findOne.mockResolvedValue(null);

    await processor.process(
      makeJob({
        attachmentPublicId: 'att-1',
        attachmentChecksum: 'a'.repeat(64),
        force: false,
      })
    );

    expect(ingestionService.markFailed).toHaveBeenCalledWith(
      'gen-1',
      'ATTACHMENT_NOT_FOUND',
      expect.stringContaining('att-1')
    );
  });

  it('marks FAILED when attachment has no OCR text', async () => {
    generationRepository.findOne.mockResolvedValue({
      generationUuid: 'gen-1',
      attachmentUuid: 'att-1',
      status: 'BUILDING',
    });
    attachmentRepository.findOne.mockResolvedValue({
      publicId: 'att-1',
      ocrText: '',
      mimeType: 'application/pdf',
    });

    await processor.process(
      makeJob({
        attachmentPublicId: 'att-1',
        attachmentChecksum: 'a'.repeat(64),
        force: false,
      })
    );

    expect(ingestionService.markFailed).toHaveBeenCalledWith(
      'gen-1',
      'NO_OCR_TEXT',
      expect.any(String)
    );
  });

  it('marks FAILED when owner context cannot be resolved', async () => {
    generationRepository.findOne.mockResolvedValue({
      generationUuid: 'gen-1',
      attachmentUuid: 'att-1',
      status: 'BUILDING',
    });
    attachmentRepository.findOne.mockResolvedValue({
      publicId: 'att-1',
      ocrText: 'some text',
      mimeType: 'application/pdf',
    });
    attachmentSourceService.resolveFromAttachment.mockResolvedValue(null);

    await processor.process(
      makeJob({
        attachmentPublicId: 'att-1',
        attachmentChecksum: 'a'.repeat(64),
        force: false,
      })
    );

    expect(ingestionService.markFailed).toHaveBeenCalledWith(
      'gen-1',
      'OWNER_CONTEXT_NOT_FOUND',
      expect.any(String)
    );
  });

  it('marks FAILED when chunking produces zero chunks', async () => {
    generationRepository.findOne.mockResolvedValue({
      generationUuid: 'gen-1',
      attachmentUuid: 'att-1',
      status: 'BUILDING',
    });
    attachmentRepository.findOne.mockResolvedValue({
      publicId: 'att-1',
      ocrText: 'some text',
      mimeType: 'application/pdf',
      classification: 'INTERNAL',
    });
    attachmentSourceService.resolveFromAttachment.mockResolvedValue(
      mockOwnerContext
    );
    textSegmentService.normalizeWholeDocument.mockReturnValue(mockSegment);
    chunkingService.chunkSegment.mockReturnValue([]);

    await processor.process(
      makeJob({
        attachmentPublicId: 'att-1',
        attachmentChecksum: 'a'.repeat(64),
        force: false,
      })
    );

    expect(ingestionService.markFailed).toHaveBeenCalledWith(
      'gen-1',
      'NO_CHUNKS',
      expect.any(String)
    );
  });

  it('completes full ingestion pipeline: segment → chunk → embed → persist → activate → upsert', async () => {
    generationRepository.findOne.mockResolvedValue({
      generationUuid: 'gen-1',
      attachmentUuid: 'att-1',
      status: 'BUILDING',
    });
    attachmentRepository.findOne.mockResolvedValue({
      publicId: 'att-1',
      ocrText: 'sample text for chunking',
      mimeType: 'application/pdf',
      classification: 'INTERNAL',
    });
    attachmentSourceService.resolveFromAttachment.mockResolvedValue(
      mockOwnerContext
    );
    textSegmentService.normalizeWholeDocument.mockReturnValue(mockSegment);
    chunkingService.chunkSegment.mockReturnValue([mockDraft]);
    embeddingService.embedChunk.mockResolvedValue(mockEmbedResult);
    embeddingService.buildQdrantPoint.mockReturnValue({
      id: mockDraft.chunkPublicId,
      vector: {
        bge_dense: mockEmbedResult.dense,
        bge_sparse: mockEmbedResult.sparse,
      },
      payload: {},
    });

    await processor.process(
      makeJob({
        attachmentPublicId: 'att-1',
        attachmentChecksum: 'a'.repeat(64),
        force: false,
      })
    );

    expect(pageRepository.save).toHaveBeenCalled();
    expect(chunkRepository.save).toHaveBeenCalled();
    expect(ingestionService.markVerified).toHaveBeenCalledWith(
      'gen-1',
      'a'.repeat(64)
    );
    expect(ingestionService.activate).toHaveBeenCalledWith('gen-1');
    expect(qdrantService.upsert).toHaveBeenCalledWith(
      mockOwnerContext.projectPublicId,
      expect.any(Array)
    );
  });

  it('marks FAILED when all chunk embeddings fail', async () => {
    generationRepository.findOne.mockResolvedValue({
      generationUuid: 'gen-1',
      attachmentUuid: 'att-1',
      status: 'BUILDING',
    });
    attachmentRepository.findOne.mockResolvedValue({
      publicId: 'att-1',
      ocrText: 'sample text for chunking',
      mimeType: 'application/pdf',
      classification: 'INTERNAL',
    });
    attachmentSourceService.resolveFromAttachment.mockResolvedValue(
      mockOwnerContext
    );
    textSegmentService.normalizeWholeDocument.mockReturnValue(mockSegment);
    chunkingService.chunkSegment.mockReturnValue([mockDraft]);
    embeddingService.embedChunk.mockRejectedValue(new Error('Sidecar down'));

    await processor.process(
      makeJob({
        attachmentPublicId: 'att-1',
        attachmentChecksum: 'a'.repeat(64),
        force: false,
      })
    );

    expect(ingestionService.markFailed).toHaveBeenCalledWith(
      'gen-1',
      'ALL_CHUNKS_FAILED',
      expect.any(String)
    );
    expect(chunkRepository.save).not.toHaveBeenCalled();
  });

  it('marks FAILED with INGESTION_ERROR when unexpected error occurs', async () => {
    generationRepository.findOne.mockResolvedValue({
      generationUuid: 'gen-1',
      attachmentUuid: 'att-1',
      status: 'BUILDING',
    });
    attachmentRepository.findOne.mockRejectedValue(new Error('DB down'));

    await processor.process(
      makeJob({
        attachmentPublicId: 'att-1',
        attachmentChecksum: 'a'.repeat(64),
        force: false,
      })
    );

    expect(ingestionService.markFailed).toHaveBeenCalledWith(
      'gen-1',
      'INGESTION_ERROR',
      'DB down'
    );
  });

  it('creates SECTION segment for ZIP attachments with file path in OCR text', async () => {
    generationRepository.findOne.mockResolvedValue({
      generationUuid: 'gen-1',
      attachmentUuid: 'att-1',
      status: 'BUILDING',
    });
    attachmentRepository.findOne.mockResolvedValue({
      publicId: 'att-1',
      ocrText: 'docs/spec.pdf content here',
      mimeType: 'application/zip',
      classification: 'INTERNAL',
    });
    attachmentSourceService.resolveFromAttachment.mockResolvedValue(
      mockOwnerContext
    );
    const sectionSegment: RagTextSegment = {
      segmentType: 'SECTION',
      segmentNumber: 1,
      segmentLabel: 'docs/spec.pdf',
      text: 'docs/spec.pdf content here',
      sourceLocator: 'docs/spec.pdf',
    };
    textSegmentService.normalizeSection.mockReturnValue(sectionSegment);
    chunkingService.chunkSegment.mockReturnValue([mockDraft]);
    embeddingService.embedChunk.mockResolvedValue(mockEmbedResult);
    embeddingService.buildQdrantPoint.mockReturnValue({
      id: mockDraft.chunkPublicId,
      vector: {
        bge_dense: mockEmbedResult.dense,
        bge_sparse: mockEmbedResult.sparse,
      },
      payload: {},
    });

    await processor.process(
      makeJob({
        attachmentPublicId: 'att-1',
        attachmentChecksum: 'a'.repeat(64),
        force: false,
      })
    );

    expect(textSegmentService.normalizeSection).toHaveBeenCalledWith(
      1,
      'docs/spec.pdf',
      'docs/spec.pdf content here',
      'docs/spec.pdf'
    );
  });

  it('falls back to WHOLE_DOCUMENT for ZIP without file path in OCR text', async () => {
    generationRepository.findOne.mockResolvedValue({
      generationUuid: 'gen-1',
      attachmentUuid: 'att-1',
      status: 'BUILDING',
    });
    attachmentRepository.findOne.mockResolvedValue({
      publicId: 'att-1',
      ocrText: 'no file path here',
      mimeType: 'application/zip',
      classification: 'INTERNAL',
    });
    attachmentSourceService.resolveFromAttachment.mockResolvedValue(
      mockOwnerContext
    );
    textSegmentService.normalizeWholeDocument.mockReturnValue(mockSegment);
    chunkingService.chunkSegment.mockReturnValue([mockDraft]);
    embeddingService.embedChunk.mockResolvedValue(mockEmbedResult);
    embeddingService.buildQdrantPoint.mockReturnValue({
      id: mockDraft.chunkPublicId,
      vector: {
        bge_dense: mockEmbedResult.dense,
        bge_sparse: mockEmbedResult.sparse,
      },
      payload: {},
    });

    await processor.process(
      makeJob({
        attachmentPublicId: 'att-1',
        attachmentChecksum: 'a'.repeat(64),
        force: false,
      })
    );

    expect(textSegmentService.normalizeWholeDocument).toHaveBeenCalledWith(
      'no file path here'
    );
    expect(textSegmentService.normalizeSection).not.toHaveBeenCalled();
  });
});
