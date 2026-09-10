// File: backend/test/rag-admin-metrics.e2e-spec.ts
// Change Log:
// - 2026-09-10: T066 — E2E test สำหรับ US4 metrics flow (Feature 255)

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RbacGuard } from '../src/common/guards/rbac.guard';
import { AiEnabledGuard } from '../src/modules/ai/guards/ai-enabled.guard';
import { Attachment } from '../src/common/file-storage/entities/attachment.entity';
import { AuditLog } from '../src/common/entities/audit-log.entity';
import { RagAttachmentGeneration } from '../src/modules/ai/entities/rag-attachment-generation.entity';
import { RagAttachmentChunk } from '../src/modules/ai/entities/rag-attachment-chunk.entity';
import { RagAttachmentPage } from '../src/modules/ai/entities/rag-attachment-page.entity';
import { RagAdminController } from '../src/modules/ai/rag-admin.controller';
import { RagAdminService } from '../src/modules/ai/services/rag-admin.service';
import { RagObservabilityService } from '../src/modules/ai/services/rag-observability.service';
import { RagAttachmentIngestionService } from '../src/modules/ai/services/rag-attachment-ingestion.service';
import { AiQueueService } from '../src/modules/ai/ai-queue.service';

/** Typed response bodies */
interface MetricsResponse {
  ingestionDuration: { count: number };
  chunkCount: { totalChunks: number };
  vectorLatency: { count: number };
  staleResultRate: { filtered: number };
  fallbackRate: { fullTextFallbacks: number };
  cleanupRetryRate: { retries: number };
}
interface ResetResponse {
  reset: boolean;
  scope: string;
}

describe('RAG Admin Metrics flow (E2E) — Feature 255 T066', () => {
  let app: INestApplication;

  const mockRagAdminService = {};
  const mockObservabilityService = {
    getSnapshot: jest.fn(),
    reset: jest.fn(),
  };
  const mockIngestionService = {};
  const mockAiQueueService = {};

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RagAdminController],
      providers: [
        { provide: RagAdminService, useValue: mockRagAdminService },
        {
          provide: RagObservabilityService,
          useValue: mockObservabilityService,
        },
        {
          provide: RagAttachmentIngestionService,
          useValue: mockIngestionService,
        },
        { provide: AiQueueService, useValue: mockAiQueueService },
        { provide: DataSource, useValue: {} },
        { provide: getRepositoryToken(Attachment), useValue: {} },
        { provide: getRepositoryToken(RagAttachmentGeneration), useValue: {} },
        { provide: getRepositoryToken(RagAttachmentChunk), useValue: {} },
        { provide: getRepositoryToken(RagAttachmentPage), useValue: {} },
        { provide: getRepositoryToken(AuditLog), useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RbacGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AiEnabledGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /ai/admin/rag/metrics — should return metrics snapshot', async () => {
    const mockSnapshot = {
      ingestionDuration: {
        count: 10,
        sumMs: 5000,
        buckets: { '100': 5, '500': 3, '2000': 2 },
      },
      chunkCount: { totalChunks: 100, ingestions: 10 },
      vectorLatency: {
        count: 50,
        sumMs: 1000,
        buckets: { '50': 20, '100': 15, '500': 10, '2000': 5 },
      },
      staleResultRate: { filtered: 5, total: 100 },
      fallbackRate: { fullTextFallbacks: 3, totalQueries: 100 },
      cleanupRetryRate: { retries: 2 },
      uptimeMs: 60000,
    };
    mockObservabilityService.getSnapshot.mockReturnValue(mockSnapshot);

    const response = await request(app.getHttpServer() as import('http').Server)
      .get('/ai/admin/rag/metrics')
      .expect(200);

    expect((response.body as MetricsResponse).ingestionDuration.count).toBe(10);
    expect((response.body as MetricsResponse).chunkCount.totalChunks).toBe(100);
    expect((response.body as MetricsResponse).vectorLatency.count).toBe(50);
    expect((response.body as MetricsResponse).staleResultRate.filtered).toBe(5);
    expect(
      (response.body as MetricsResponse).fallbackRate.fullTextFallbacks
    ).toBe(3);
    expect((response.body as MetricsResponse).cleanupRetryRate.retries).toBe(2);
  });

  it('POST /ai/admin/rag/metrics/reset — should reset metrics globally (Q15)', async () => {
    mockObservabilityService.reset.mockReturnValue(undefined);

    const response = await request(app.getHttpServer() as import('http').Server)
      .post('/ai/admin/rag/metrics/reset')
      .expect(200);

    expect(mockObservabilityService.reset).toHaveBeenCalled();
    expect((response.body as ResetResponse).reset).toBe(true);
    expect((response.body as ResetResponse).scope).toBe('global');
  });
});
