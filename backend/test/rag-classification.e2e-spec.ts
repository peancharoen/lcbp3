// File: backend/test/rag-classification.e2e-spec.ts
// Change Log:
// - 2026-09-14: T066 — เพิ่ม E2E tests สำหรับ classification retrieval + metadata sync (Feature 254, Phase 7 US5)

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RbacGuard } from '../src/common/guards/rbac.guard';
import { Attachment } from '../src/common/file-storage/entities/attachment.entity';
import { AuditLog } from '../src/common/entities/audit-log.entity';
import { AuditLogInterceptor } from '../src/common/interceptors/audit-log.interceptor';
import { RagAttachmentGeneration } from '../src/modules/ai/entities/rag-attachment-generation.entity';
import { RagAttachmentChunk } from '../src/modules/ai/entities/rag-attachment-chunk.entity';
import { RagAttachmentPage } from '../src/modules/ai/entities/rag-attachment-page.entity';
import { RagAttachmentController } from '../src/modules/ai/rag-attachment.controller';
import { RagGenerationService } from '../src/modules/ai/services/rag-generation.service';
import { RagAttachmentIngestionService } from '../src/modules/ai/services/rag-attachment-ingestion.service';
import { RagRetrievalService } from '../src/modules/ai/services/rag-retrieval.service';
import { RagGenerationLockService } from '../src/modules/ai/services/rag-generation-lock.service';
import { RagErrorService } from '../src/modules/ai/services/rag-error.service';
import { AiQueueService } from '../src/modules/ai/ai-queue.service';
import { OcrService } from '../src/modules/ai/services/ocr.service';
import { AiQdrantService } from '../src/modules/ai/qdrant.service';

const ATTACHMENT_ID = '019505a1-7c3e-7000-8000-abc123def456';
const PROJECT_ID = '019505a1-7c3e-7000-8000-aab123def456';

/**
 * E2E tests สำหรับ classification retrieval access + metadata sync (Feature 254, T066)
 * ทดสอบผ่าน NestJS DI + supertest โดยใช้ mock services (ไม่ต้อง Qdrant/Redis/OCR sidecar จริง)
 * ครอบคลุม:
 *   - override-classification permission (403/200)
 *   - audit event recording
 *   - classification filter ใน retrieval
 *   - Qdrant metadata sync เมื่อ classification เปลี่ยน
 *   - response ไม่เปิดเผย generationUuid
 *
 * Mock: RagAttachmentIngestionService, RagRetrievalService, OcrService,
 *       AiQueueService, AuditLog repository (infra-dependent services)
 * Override: JwtAuthGuard (pass-through), RbacGuard (controllable สำหรับ 403 test)
 */
describe('RAG classification retrieval + metadata sync (E2E) — Feature 254 T066', () => {
  let app: INestApplication;

  /** Mock services สำหรับ infra-dependent dependencies */
  const ingestionService = { ingest: jest.fn() };
  const generationService = {
    getStatus: jest.fn(),
    overrideClassification: jest.fn(),
  };
  const retrievalService = { retrieve: jest.fn() };
  const ocrService = { embedViaSidecar: jest.fn() };
  const aiQueueService = { enqueueRagAttachmentIngestion: jest.fn() };

  /** Mock AuditLog repository สำหรับ AuditLogInterceptor */
  const auditLogRepo = {
    create: jest.fn((payload: unknown) => payload),
    save: jest.fn().mockResolvedValue({ auditId: 'audit-001' }),
  };

  /** AuditLogInterceptor instance สร้างเองเพื่อหลีกเลี่ยง DI ปัญหาใน TestingModule */
  const reflector = new Reflector();
  const auditInterceptor = new AuditLogInterceptor(
    reflector,
    auditLogRepo as never
  );

  /** Controllable RbacGuard — default ปล่อยผ่าน, toggle เป็น false สำหรับ 403 test */
  const rbacGuardMock = { canActivate: jest.fn() };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RagAttachmentController],
      providers: [
        { provide: RagAttachmentIngestionService, useValue: ingestionService },
        { provide: RagGenerationService, useValue: generationService },
        { provide: RagRetrievalService, useValue: retrievalService },
        { provide: OcrService, useValue: ocrService },
        { provide: AiQueueService, useValue: aiQueueService },
        { provide: RagGenerationLockService, useValue: {} },
        { provide: RagErrorService, useValue: new RagErrorService() },
        { provide: DataSource, useValue: {} },
        { provide: getRepositoryToken(Attachment), useValue: {} },
        {
          provide: getRepositoryToken(RagAttachmentGeneration),
          useValue: {},
        },
        { provide: getRepositoryToken(RagAttachmentChunk), useValue: {} },
        { provide: getRepositoryToken(RagAttachmentPage), useValue: {} },
        { provide: getRepositoryToken(AuditLog), useValue: auditLogRepo },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RbacGuard)
      .useValue(rbacGuardMock)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.useGlobalInterceptors(auditInterceptor);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // default: RbacGuard ปล่อยผ่าน (มีสิทธิ์)
    rbacGuardMock.canActivate.mockReturnValue(true);
    // re-stub ค่าที่ clearAllMocks ลบไป
    auditLogRepo.create.mockImplementation((payload: unknown) => payload);
    auditLogRepo.save.mockResolvedValue({ auditId: 'audit-001' });
  });

  // -------------------------------------------------------------------------
  // Test 1: PATCH override-classification โดยไม่มีสิทธิ์ คืน 403
  // -------------------------------------------------------------------------
  it('1. PATCH override-classification โดยไม่มีสิทธิ์ document.classification_override คืน 403', async () => {
    rbacGuardMock.canActivate.mockReturnValue(false);

    await request(app.getHttpServer() as () => void)
      .patch(`/ai/rag/attachments/${ATTACHMENT_ID}/classification`)
      .send({ classification: 'CONFIDENTIAL' })
      .expect(403);

    // ยืนยันว่า service ไม่ถูกเรียกเมื่อ guard ปฏิเสธ
    expect(generationService.overrideClassification).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Test 2: PATCH override-classification โดยมีสิทธิ์ คืน 200 และอัปเดต classification
  // -------------------------------------------------------------------------
  it('2. PATCH override-classification โดยมีสิทธิ์ คืน 200 พร้อม classification ใหม่', async () => {
    generationService.overrideClassification.mockResolvedValue(undefined);

    const res = await request(app.getHttpServer() as () => void)
      .patch(`/ai/rag/attachments/${ATTACHMENT_ID}/classification`)
      .send({ classification: 'CONFIDENTIAL' })
      .expect(200);

    const body = res.body as Record<string, unknown>;
    expect(body).toEqual({
      attachmentPublicId: ATTACHMENT_ID,
      classification: 'CONFIDENTIAL',
    });
    expect(generationService.overrideClassification).toHaveBeenCalledWith(
      ATTACHMENT_ID,
      'CONFIDENTIAL'
    );
  });

  // -------------------------------------------------------------------------
  // Test 3: PATCH override-classification บันทึก audit event
  // -------------------------------------------------------------------------
  it('3. PATCH override-classification บันทึก audit event ด้วย action rag.attachment.classification_override', async () => {
    generationService.overrideClassification.mockResolvedValue(undefined);

    await request(app.getHttpServer() as () => void)
      .patch(`/ai/rag/attachments/${ATTACHMENT_ID}/classification`)
      .send({ classification: 'INTERNAL' })
      .expect(200);

    // AuditLogInterceptor บันทึก audit log หลัง handler สำเร็จ
    expect(auditLogRepo.save).toHaveBeenCalledTimes(1);
    const savedPayload = auditLogRepo.create.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(savedPayload['action']).toBe(
      'rag.attachment.classification_override'
    );
    expect(savedPayload['entityType']).toBe('rag_attachment');
  });

  // -------------------------------------------------------------------------
  // Test 4: POST query ที่กรองตาม classification คืนเฉพาะ chunks ใน classification ที่อนุญาต
  // -------------------------------------------------------------------------
  it('4. POST query ที่กรองตาม classification คืนเฉพาะ chunks ใน classification ที่อนุญาตเท่านั้น', async () => {
    ocrService.embedViaSidecar.mockResolvedValue({
      dense: Array(1024).fill(0.1),
      sparse: { indices: [1], values: [0.5] },
    });
    // retrievalService กรองเฉพาะ PUBLIC chunks (จำลอง classification filtering)
    retrievalService.retrieve.mockResolvedValue({
      citations: [
        {
          chunkPublicId: 'chunk-public-1',
          attachmentPublicId: ATTACHMENT_ID,
          ownerType: 'CORRESPONDENCE',
          ownerPublicId: 'corr-1',
          content: 'public content',
          segmentType: 'PAGE',
          score: 0.95,
        },
      ],
      totalFound: 3,
      skippedStale: 2,
    });

    const res = await request(app.getHttpServer() as () => void)
      .post('/ai/rag/attachments/query')
      .send({ projectPublicId: PROJECT_ID, query: 'test', topK: 10 })
      .expect(200);

    const body = res.body as Record<string, unknown>;
    const citations = body['citations'] as Array<Record<string, unknown>>;
    expect(citations).toHaveLength(1);
    expect(citations[0]['chunkPublicId']).toBe('chunk-public-1');
    // ไม่ควรมี chunk ที่เป็น CONFIDENTIAL ปนมา
    expect(
      citations.every((c) => c['chunkPublicId'] !== 'chunk-confidential-1')
    ).toBe(true);
    expect(retrievalService.retrieve).toHaveBeenCalledWith(
      PROJECT_ID,
      expect.any(Array),
      10
    );
  });

  // -------------------------------------------------------------------------
  // Test 6: response ของ override-classification ไม่เปิดเผย generationUuid
  // -------------------------------------------------------------------------
  it('6. response ของ override-classification ไม่เปิดเผย generationUuid', async () => {
    generationService.overrideClassification.mockResolvedValue(undefined);

    const res = await request(app.getHttpServer() as () => void)
      .patch(`/ai/rag/attachments/${ATTACHMENT_ID}/classification`)
      .send({ classification: 'PUBLIC' })
      .expect(200);

    const body = res.body as Record<string, unknown>;
    expect(body).not.toHaveProperty('generationUuid');
  });

  // -------------------------------------------------------------------------
  // ส่วน Qdrant metadata sync: ใช้ service จริง + mock repositories/Qdrant
  // เพื่อยืนยันว่า classification change ควร trigger Qdrant metadata sync
  // -------------------------------------------------------------------------
  describe('Qdrant metadata sync (service-level contract)', () => {
    let generationSvc: RagGenerationService;

    const attachmentRepository = { findOne: jest.fn(), update: jest.fn() };
    const genRepo = { findOne: jest.fn(), update: jest.fn() };
    const chunkRepo = { count: jest.fn(), find: jest.fn() };
    const lockService = { acquire: jest.fn(), release: jest.fn() };
    const qdrantService = {
      updateClassificationMetadata: jest.fn().mockResolvedValue(undefined),
    };

    beforeAll(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RagGenerationService,
          {
            provide: getRepositoryToken(Attachment),
            useValue: attachmentRepository,
          },
          {
            provide: getRepositoryToken(RagAttachmentGeneration),
            useValue: genRepo,
          },
          {
            provide: getRepositoryToken(RagAttachmentChunk),
            useValue: chunkRepo,
          },
          { provide: DataSource, useValue: {} },
          { provide: RagGenerationLockService, useValue: lockService },
          { provide: RagErrorService, useValue: new RagErrorService() },
          { provide: AiQdrantService, useValue: qdrantService },
        ],
      }).compile();

      generationSvc = module.get<RagGenerationService>(RagGenerationService);
    });

    beforeEach(() => {
      jest.clearAllMocks();
      attachmentRepository.findOne.mockResolvedValue({
        publicId: ATTACHMENT_ID,
        classification: 'INTERNAL',
      });
      attachmentRepository.update.mockResolvedValue(undefined);
      qdrantService.updateClassificationMetadata.mockResolvedValue(undefined);
    });

    // -------------------------------------------------------------------
    // Test 5: classification change trigger Qdrant metadata sync
    // -------------------------------------------------------------------
    it('5. classification change trigger Qdrant metadata sync สำหรับ chunks ของ attachment', async () => {
      await generationSvc.overrideClassification(ATTACHMENT_ID, 'CONFIDENTIAL');

      // ยืนยันว่าอัปเดต classification ใน DB
      expect(attachmentRepository.update).toHaveBeenCalledWith(
        { publicId: ATTACHMENT_ID },
        { classification: 'CONFIDENTIAL' }
      );

      // ยืนยันว่า Qdrant metadata sync ถูกเรียก (TDD: ยังไม่ implemented → RED)
      expect(qdrantService.updateClassificationMetadata).toHaveBeenCalledWith(
        ATTACHMENT_ID,
        'CONFIDENTIAL'
      );
    });
  });
});
