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
});
