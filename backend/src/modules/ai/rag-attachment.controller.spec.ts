// File: backend/src/modules/ai/rag-attachment.controller.spec.ts
// Change Log:
// - 2026-09-09: เพิ่ม tests สำหรับ RAG Attachment ingestion/status endpoints (Feature 254)

import { ValidationException } from '../../common/exceptions';
import { RagAttachmentController } from './rag-attachment.controller';

describe('RagAttachmentController', () => {
  const generationService = {
    createBuildingGeneration: jest.fn(),
    getStatus: jest.fn(),
  };
  const ingestionService = {
    ingest: jest.fn(),
  };
  const retrievalService = {
    retrieve: jest.fn(),
  };
  const ocrService = {
    embedViaSidecar: jest.fn(),
  };
  const aiQueueService = {
    enqueueRagAttachmentIngestion: jest.fn(),
  };
  const controller = new RagAttachmentController(
    generationService as never,
    ingestionService as never,
    retrievalService as never,
    ocrService as never,
    aiQueueService as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects ingestion when Idempotency-Key is missing', async () => {
    await expect(
      controller.ingest('019505a1-7c3e-7000-8000-abc123def456', {}, undefined)
    ).rejects.toBeInstanceOf(ValidationException);
    expect(ingestionService.ingest).not.toHaveBeenCalled();
  });

  it('creates a generation and enqueues ingestion without exposing generation UUID', async () => {
    ingestionService.ingest.mockResolvedValue({
      generationUuid: '019505a2-7c3e-7000-8000-abc123def456',
      attachmentChecksumSnapshot: 'a'.repeat(64),
      status: 'BUILDING',
    });
    aiQueueService.enqueueRagAttachmentIngestion.mockResolvedValue('job-1');

    const result = await controller.ingest(
      '019505a1-7c3e-7000-8000-abc123def456',
      { force: false },
      'request-1'
    );

    expect(result).toEqual({
      attachmentPublicId: '019505a1-7c3e-7000-8000-abc123def456',
      status: 'BUILDING',
      jobId: 'job-1',
    });
    expect(result).not.toHaveProperty('generationUuid');
  });

  it('returns the latest ingestion status', async () => {
    const status = {
      attachmentPublicId: '019505a1-7c3e-7000-8000-abc123def456',
      status: 'ACTIVE',
      chunkCount: 3,
    };
    generationService.getStatus.mockResolvedValue(status);

    await expect(
      controller.status('019505a1-7c3e-7000-8000-abc123def456')
    ).resolves.toEqual(status);
  });

  it('overrides classification when Superadmin requests it', async () => {
    generationService.overrideClassification = jest
      .fn()
      .mockResolvedValue(undefined);

    const result = await controller.overrideClassification(
      '019505a1-7c3e-7000-8000-abc123def456',
      { classification: 'CONFIDENTIAL' }
    );

    expect(generationService.overrideClassification).toHaveBeenCalledWith(
      '019505a1-7c3e-7000-8000-abc123def456',
      'CONFIDENTIAL'
    );
    expect(result).toEqual({
      attachmentPublicId: '019505a1-7c3e-7000-8000-abc123def456',
      classification: 'CONFIDENTIAL',
    });
  });

  // --- Additional tests for branch coverage ---

  it('rejects ingestion when Idempotency-Key is empty string', async () => {
    await expect(
      controller.ingest('019505a1-7c3e-7000-8000-abc123def456', {}, '   ')
    ).rejects.toBeInstanceOf(ValidationException);
    expect(ingestionService.ingest).not.toHaveBeenCalled();
  });

  it('returns ACTIVE status when generation is already ACTIVE (idempotent ingest)', async () => {
    ingestionService.ingest.mockResolvedValue({
      generationUuid: '019505a2-7c3e-7000-8000-abc123def456',
      attachmentChecksumSnapshot: 'a'.repeat(64),
      status: 'ACTIVE',
    });
    aiQueueService.enqueueRagAttachmentIngestion.mockResolvedValue('job-2');

    const result = await controller.ingest(
      '019505a1-7c3e-7000-8000-abc123def456',
      { force: false },
      'request-2'
    );

    expect(result).toEqual({
      attachmentPublicId: '019505a1-7c3e-7000-8000-abc123def456',
      status: 'ACTIVE',
      jobId: 'job-2',
    });
  });

  it('passes force=true to ingestionService when dto.force is true', async () => {
    ingestionService.ingest.mockResolvedValue({
      generationUuid: '019505a2-7c3e-7000-8000-abc123def456',
      attachmentChecksumSnapshot: 'a'.repeat(64),
      status: 'BUILDING',
    });
    aiQueueService.enqueueRagAttachmentIngestion.mockResolvedValue('job-3');

    await controller.ingest(
      '019505a1-7c3e-7000-8000-abc123def456',
      { force: true },
      'request-3'
    );

    expect(ingestionService.ingest).toHaveBeenCalledWith(
      '019505a1-7c3e-7000-8000-abc123def456',
      true
    );
    expect(aiQueueService.enqueueRagAttachmentIngestion).toHaveBeenCalledWith(
      expect.objectContaining({ force: true })
    );
  });

  it('defaults force to false when dto.force is undefined', async () => {
    ingestionService.ingest.mockResolvedValue({
      generationUuid: '019505a2-7c3e-7000-8000-abc123def456',
      attachmentChecksumSnapshot: 'a'.repeat(64),
      status: 'BUILDING',
    });
    aiQueueService.enqueueRagAttachmentIngestion.mockResolvedValue('job-4');

    await controller.ingest(
      '019505a1-7c3e-7000-8000-abc123def456',
      {},
      'request-4'
    );

    expect(ingestionService.ingest).toHaveBeenCalledWith(
      '019505a1-7c3e-7000-8000-abc123def456',
      false
    );
  });

  it('queries RAG with project-scoped retrieval and returns citations', async () => {
    ocrService.embedViaSidecar.mockResolvedValue({
      dense: [0.1, 0.2],
      sparse: { indices: [0], values: [0.5] },
      device: 'cpu',
    });
    const citations = [
      {
        chunkPublicId: '019505a3-7c3e-7000-8000-abc123def456',
        attachmentPublicId: '019505a1-7c3e-7000-8000-abc123def456',
        ownerType: 'CORRESPONDENCE',
        ownerPublicId: '019505a4-7c3e-7000-8000-abc123def456',
        content: 'chunk content',
        segmentType: 'PAGE' as const,
        segmentNumber: 1,
        segmentLabel: 'Page 1',
        sourceLocator: undefined,
        score: 0.95,
      },
    ];
    retrievalService.retrieve.mockResolvedValue({
      citations,
      totalFound: 1,
      skippedStale: 0,
    });

    const result = await controller.query({
      projectPublicId: '019505a5-7c3e-7000-8000-abc123def456',
      query: 'test query',
      topK: 5,
    });

    expect(ocrService.embedViaSidecar).toHaveBeenCalledWith('test query');
    expect(retrievalService.retrieve).toHaveBeenCalledWith(
      '019505a5-7c3e-7000-8000-abc123def456',
      [0.1, 0.2],
      5
    );
    expect(result).toEqual({
      projectPublicId: '019505a5-7c3e-7000-8000-abc123def456',
      citations,
      totalFound: 1,
      skippedStale: 0,
    });
  });

  it('defaults topK to 10 when not provided in query', async () => {
    ocrService.embedViaSidecar.mockResolvedValue({
      dense: [0.1],
      sparse: { indices: [0], values: [0.5] },
      device: 'cpu',
    });
    retrievalService.retrieve.mockResolvedValue({
      citations: [],
      totalFound: 0,
      skippedStale: 0,
    });

    await controller.query({
      projectPublicId: '019505a5-7c3e-7000-8000-abc123def456',
      query: 'test',
    });

    expect(retrievalService.retrieve).toHaveBeenCalledWith(
      '019505a5-7c3e-7000-8000-abc123def456',
      [0.1],
      10
    );
  });

  it('uses classificationService when available (production path)', async () => {
    const classificationService = {
      overrideClassification: jest.fn().mockResolvedValue(undefined),
    };
    const controllerWithClassification = new RagAttachmentController(
      generationService as never,
      ingestionService as never,
      retrievalService as never,
      ocrService as never,
      aiQueueService as never,
      classificationService as never
    );

    const result = await controllerWithClassification.overrideClassification(
      '019505a1-7c3e-7000-8000-abc123def456',
      { classification: 'PUBLIC', reason: 'declassify' },
      { user: { id: 1, role: 'SUPERADMIN' } } as never
    );

    expect(classificationService.overrideClassification).toHaveBeenCalledWith(
      expect.objectContaining({
        attachmentPublicId: '019505a1-7c3e-7000-8000-abc123def456',
        newClassification: 'PUBLIC',
        reason: 'declassify',
      })
    );
    expect(generationService.overrideClassification).not.toHaveBeenCalled();
    expect(result).toEqual({
      attachmentPublicId: '019505a1-7c3e-7000-8000-abc123def456',
      classification: 'PUBLIC',
    });
  });

  it('passes reason to classificationService when provided', async () => {
    const classificationService = {
      overrideClassification: jest.fn().mockResolvedValue(undefined),
    };
    const controllerWithClassification = new RagAttachmentController(
      generationService as never,
      ingestionService as never,
      retrievalService as never,
      ocrService as never,
      aiQueueService as never,
      classificationService as never
    );

    await controllerWithClassification.overrideClassification(
      '019505a1-7c3e-7000-8000-abc123def456',
      { classification: 'CONFIDENTIAL', reason: 'security review' },
      { user: { id: 1 } } as never
    );

    expect(classificationService.overrideClassification).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'security review',
      })
    );
  });

  it('defaults reason to empty string when not provided', async () => {
    const classificationService = {
      overrideClassification: jest.fn().mockResolvedValue(undefined),
    };
    const controllerWithClassification = new RagAttachmentController(
      generationService as never,
      ingestionService as never,
      retrievalService as never,
      ocrService as never,
      aiQueueService as never,
      classificationService as never
    );

    await controllerWithClassification.overrideClassification(
      '019505a1-7c3e-7000-8000-abc123def456',
      { classification: 'INTERNAL' },
      { user: { id: 1 } } as never
    );

    expect(classificationService.overrideClassification).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: '',
      })
    );
  });
});
