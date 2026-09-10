// File: backend/test/rag-generation-replacement.e2e-spec.ts
// Change Log:
// - 2026-09-12: T048 — เพิ่ม E2E tests สำหรับ full replacement flow (Feature 254, Phase 5 US3)

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RbacGuard } from '../src/common/guards/rbac.guard';
import { Attachment } from '../src/common/file-storage/entities/attachment.entity';
import { RagAttachmentGeneration } from '../src/modules/ai/entities/rag-attachment-generation.entity';
import { RagAttachmentChunk } from '../src/modules/ai/entities/rag-attachment-chunk.entity';
import { RagAttachmentPage } from '../src/modules/ai/entities/rag-attachment-page.entity';
import { RagAttachmentController } from '../src/modules/ai/rag-attachment.controller';
import { RagGenerationService } from '../src/modules/ai/services/rag-generation.service';
import { RagAttachmentIngestionService } from '../src/modules/ai/services/rag-attachment-ingestion.service';
import { RagRetrievalService } from '../src/modules/ai/services/rag-retrieval.service';
import { RagCleanupService } from '../src/modules/ai/services/rag-cleanup.service';
import { RagGenerationLockService } from '../src/modules/ai/services/rag-generation-lock.service';
import { RagErrorService } from '../src/modules/ai/services/rag-error.service';
import { AiQueueService } from '../src/modules/ai/ai-queue.service';
import { OcrService } from '../src/modules/ai/services/ocr.service';
import { AiQdrantService } from '../src/modules/ai/qdrant.service';

const ATTACHMENT_ID = '019505a1-7c3e-7000-8000-abc123def456';
const PROJECT_ID = '019505a1-7c3e-7000-8000-aab123def456';
const OLD_GEN_UUID = '019505a1-7c3e-7000-8000-gen001old0001';
const NEW_GEN_UUID = '019505a1-7c3e-7000-8000-gen002new0002';
const NEW_CHECKSUM = 'b'.repeat(64);

/**
 * E2E tests สำหรับ full replacement flow ของ RAG Attachment generation (Feature 254, T048)
 * ทดสอบผ่าน NestJS DI + supertest โดยใช้ mock services (ไม่ต้อง Qdrant/Redis/OCR sidecar จริง)
 * ครอบคลุม replacement loop เต็มรูปแบบ:
 *   force re-ingest → new BUILDING → swap → old RETIRED → cleanup
 *
 * Mock: RagRetrievalService, OcrService, AiQueueService (infra-dependent services)
 * Override: JwtAuthGuard, RbacGuard (pass-through)
 * ส่วน activate/cleanup ใช้ service จริง + mock repositories เพื่อยืนยัน contract
 */
describe('RAG generation replacement flow (E2E) — Feature 254 T048', () => {
  let app: INestApplication;

  /** Mock ingestionService.ingest คืน object ที่มี status + attachmentChecksumSnapshot เหมือน entity */
  const ingestionService = {
    ingest: jest.fn(),
  };
  const generationService = {
    getStatus: jest.fn(),
    overrideClassification: jest.fn(),
  };
  const retrievalService = { retrieve: jest.fn() };
  const ocrService = { embedViaSidecar: jest.fn() };
  const aiQueueService = { enqueueRagAttachmentIngestion: jest.fn() };

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
        { provide: getRepositoryToken(RagAttachmentGeneration), useValue: {} },
        { provide: getRepositoryToken(RagAttachmentChunk), useValue: {} },
        { provide: getRepositoryToken(RagAttachmentPage), useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RbacGuard)
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

  // -------------------------------------------------------------------------
  // Test 1: force re-ingest สร้าง BUILDING generation ใหม่ โดย generation เดิมยัง ACTIVE
  // -------------------------------------------------------------------------
  it('1. force re-ingest สร้าง BUILDING generation ใหม่ โดย generation เดิมยัง ACTIVE', async () => {
    ingestionService.ingest.mockResolvedValue({
      generationUuid: NEW_GEN_UUID,
      status: 'BUILDING',
      attachmentChecksumSnapshot: NEW_CHECKSUM,
    });
    aiQueueService.enqueueRagAttachmentIngestion.mockResolvedValue(
      'job-replace-1'
    );

    // GET /status ยังคงคืน ACTIVE ของ generation เดิม (ยังไม่ swap)
    generationService.getStatus.mockResolvedValue({
      attachmentPublicId: ATTACHMENT_ID,
      status: 'ACTIVE',
      chunkCount: 10,
      indexedAt: '2026-09-12T10:00:00.000Z',
    });

    const res = await request(app.getHttpServer() as () => void)
      .post(`/ai/rag/attachments/${ATTACHMENT_ID}/ingest`)
      .set('Idempotency-Key', 'req-replace-1')
      .send({ force: true })
      .expect(202);

    const body = res.body as Record<string, unknown>;
    expect(body['status']).toBe('BUILDING');
    expect(body['jobId']).toBe('job-replace-1');
    expect(ingestionService.ingest).toHaveBeenCalledWith(ATTACHMENT_ID, true);

    // ยืนยันว่า generation เดิมยัง ACTIVE อยู่ (status endpoint คืน ACTIVE)
    const statusRes = await request(app.getHttpServer() as () => void)
      .get(`/ai/rag/attachments/${ATTACHMENT_ID}/status`)
      .expect(200);
    const statusBody = statusRes.body as Record<string, unknown>;
    expect(statusBody['status']).toBe('ACTIVE');
  });

  // -------------------------------------------------------------------------
  // Test 5: query ระหว่าง replacement คืนผลจาก ACTIVE (เดิม) จนกว่าจะ swap
  // -------------------------------------------------------------------------
  it('5. query ระหว่าง replacement คืนผลจาก ACTIVE (เดิม) จนกว่าจะ swap เสร็จ', async () => {
    ocrService.embedViaSidecar.mockResolvedValue({
      dense: Array(1024).fill(0.1),
      sparse: { indices: [1], values: [0.5] },
    });
    // retrieval คืน citations จาก generation เดิม (ACTIVE) — ยังไม่เห็นของใหม่
    retrievalService.retrieve.mockResolvedValue({
      citations: [
        {
          chunkPublicId: 'chunk-old-1',
          attachmentPublicId: ATTACHMENT_ID,
          ownerType: 'CORRESPONDENCE',
          ownerPublicId: 'corr-1',
          content: 'content from old ACTIVE generation',
          score: 0.92,
        },
      ],
      totalFound: 1,
      skippedStale: 0,
    });

    const res = await request(app.getHttpServer() as () => void)
      .post('/ai/rag/attachments/query')
      .send({ projectPublicId: PROJECT_ID, query: 'test', topK: 5 })
      .expect(200);

    const body = res.body as Record<string, unknown>;
    const citations = body['citations'] as Array<Record<string, unknown>>;
    expect(citations).toHaveLength(1);
    expect(citations[0]['content']).toBe('content from old ACTIVE generation');
    // retrieval ถูกเรียกด้วย projectPublicId เท่านั้น (ACTIVE guard อยู่ใน service)
    expect(retrievalService.retrieve).toHaveBeenCalledWith(
      PROJECT_ID,
      expect.any(Array),
      5
    );
  });

  // -------------------------------------------------------------------------
  // Test 6: response ไม่เปิดเผย generationUuid
  // -------------------------------------------------------------------------
  it('6. ingest response ไม่เปิดเผย generationUuid', async () => {
    ingestionService.ingest.mockResolvedValue({
      generationUuid: NEW_GEN_UUID,
      status: 'BUILDING',
      attachmentChecksumSnapshot: NEW_CHECKSUM,
    });
    aiQueueService.enqueueRagAttachmentIngestion.mockResolvedValue(
      'job-replace-2'
    );

    const res = await request(app.getHttpServer() as () => void)
      .post(`/ai/rag/attachments/${ATTACHMENT_ID}/ingest`)
      .set('Idempotency-Key', 'req-replace-2')
      .send({ force: true })
      .expect(202);

    const body = res.body as Record<string, unknown>;
    expect(body).not.toHaveProperty('generationUuid');
  });

  // -------------------------------------------------------------------------
  // ส่วน activate + cleanup: ใช้ service จริง + mock repositories/Qdrant
  // เพื่อยืนยัน contract ของ swap และ cleanup (ไม่ผ่าน HTTP เพราะเป็น background worker)
  // -------------------------------------------------------------------------
  describe('activate + cleanup (service-level contract)', () => {
    let ingestionSvc: RagAttachmentIngestionService;
    let cleanupSvc: RagCleanupService;

    // mock repositories สำหรับ ingestion + cleanup (แชร์ token ร่วมกัน)
    const attachmentRepository = { findOne: jest.fn() };
    const genRepoForIngestion = {
      findOne: jest.fn(),
      create: jest.fn((value: unknown) => value),
      save: jest.fn(),
      update: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
    };
    const chunkRepoForIngestion = {
      count: jest.fn().mockResolvedValue(0),
      find: jest.fn(),
      delete: jest.fn(),
    };
    const lock = { release: jest.fn().mockResolvedValue(undefined) };
    const lockService = { acquire: jest.fn().mockResolvedValue(lock) };
    const errorService = new RagErrorService();

    // mock สำหรับ dataSource.transaction — จำลอง manager ที่มี createQueryBuilder chain
    const queryBuilderChain = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    const managerRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilderChain),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue(managerRepo),
    };
    const dataSource = {
      transaction: jest.fn(async (cb: (m: typeof manager) => Promise<void>) => {
        await cb(manager);
      }),
    };

    // mock repositories สำหรับ cleanup service (แชร์กับ ingestion ด้านบน)
    const cleanupPageRepo = {
      delete: jest.fn(),
    };
    const qdrantService = {
      deleteByPointIds: jest.fn().mockResolvedValue(undefined),
    };

    beforeAll(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RagAttachmentIngestionService,
          RagCleanupService,
          {
            provide: getRepositoryToken(Attachment),
            useValue: attachmentRepository,
          },
          {
            provide: getRepositoryToken(RagAttachmentGeneration),
            useValue: genRepoForIngestion,
          },
          {
            provide: getRepositoryToken(RagAttachmentChunk),
            useValue: chunkRepoForIngestion,
          },
          {
            provide: getRepositoryToken(RagAttachmentPage),
            useValue: cleanupPageRepo,
          },
          { provide: DataSource, useValue: dataSource },
          { provide: RagGenerationLockService, useValue: lockService },
          { provide: RagErrorService, useValue: errorService },
          { provide: AiQdrantService, useValue: qdrantService },
        ],
      }).compile();

      ingestionSvc = module.get<RagAttachmentIngestionService>(
        RagAttachmentIngestionService
      );
      cleanupSvc = module.get<RagCleanupService>(RagCleanupService);
    });

    beforeEach(() => {
      jest.clearAllMocks();
      // re-stub ค่าที่ clearAllMocks ลบไป
      chunkRepoForIngestion.count.mockResolvedValue(0);
      lockService.acquire.mockResolvedValue(lock);
      lock.release.mockResolvedValue(undefined);
      qdrantService.deleteByPointIds.mockResolvedValue(undefined);
      managerRepo.createQueryBuilder.mockReturnValue(queryBuilderChain);
      queryBuilderChain.execute.mockResolvedValue(undefined);
      managerRepo.update.mockResolvedValue(undefined);
      manager.getRepository.mockReturnValue(managerRepo);
      dataSource.transaction.mockImplementation(
        async (cb: (m: typeof manager) => Promise<void>) => {
          await cb(manager);
        }
      );
    });

    // -------------------------------------------------------------------
    // Test 2: หลัง processing เสร็จ generation ใหม่กลายเป็น ACTIVE และเดิมกลายเป็น RETIRED
    // -------------------------------------------------------------------
    it('2. หลัง processing เสร็จ generation ใหม่กลายเป็น ACTIVE และเดิมกลายเป็น RETIRED', async () => {
      // generation ใหม่อยู่ในสถานะ BUILDING และ verified แล้ว
      genRepoForIngestion.findOne.mockResolvedValue({
        generationUuid: NEW_GEN_UUID,
        attachmentUuid: ATTACHMENT_ID,
        status: 'BUILDING',
        attachmentChecksumSnapshot: NEW_CHECKSUM,
        verifiedContentChecksum: NEW_CHECKSUM,
      });

      await ingestionSvc.activate(NEW_GEN_UUID);

      // ยืนยันว่า retire generation เดิม (UPDATE status=RETIRED WHERE status=ACTIVE)
      expect(managerRepo.createQueryBuilder).toHaveBeenCalled();
      expect(queryBuilderChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'RETIRED' })
      );
      expect(queryBuilderChain.andWhere).toHaveBeenCalledWith(
        'status = :status',
        { status: 'ACTIVE' }
      );
      // ยืนยันว่า generation ใหม่ถูก update เป็น ACTIVE
      expect(managerRepo.update).toHaveBeenCalledWith(
        { generationUuid: NEW_GEN_UUID },
        expect.objectContaining({ status: 'ACTIVE' })
      );
    });

    // -------------------------------------------------------------------
    // Test 3: มี ACTIVE generation เพียงหนึ่งเดียวในแต่ละช่วงเวลา
    // -------------------------------------------------------------------
    it('3. มี ACTIVE generation เพียงหนึ่งเดียวในแต่ละช่วงเวลา (retire เดิมก่อน activate ใหม่)', async () => {
      genRepoForIngestion.findOne.mockResolvedValue({
        generationUuid: NEW_GEN_UUID,
        attachmentUuid: ATTACHMENT_ID,
        status: 'BUILDING',
        attachmentChecksumSnapshot: NEW_CHECKSUM,
        verifiedContentChecksum: NEW_CHECKSUM,
      });

      await ingestionSvc.activate(NEW_GEN_UUID);

      // transaction ถูกเรียกครั้งเดียว (atomic swap)
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      // retire เดิมและ activate ใหม่เกิดใน transaction เดียวกัน
      expect(queryBuilderChain.execute).toHaveBeenCalledTimes(1);
      expect(managerRepo.update).toHaveBeenCalledTimes(1);
    });

    // -------------------------------------------------------------------
    // Test 4: chunks ของ RETIRED generation ถูก cleanup (Qdrant + DB)
    // -------------------------------------------------------------------
    it('4. chunks ของ RETIRED generation ถูก cleanup ทั้ง Qdrant และ DB', async () => {
      genRepoForIngestion.find.mockResolvedValue([
        {
          generationUuid: OLD_GEN_UUID,
          attachmentUuid: ATTACHMENT_ID,
          status: 'RETIRED',
          retiredAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        },
      ]);
      chunkRepoForIngestion.find.mockResolvedValue([
        { chunkPublicId: 'chunk-old-1' },
        { chunkPublicId: 'chunk-old-2' },
      ]);
      chunkRepoForIngestion.delete.mockResolvedValue({ affected: 2 });
      cleanupPageRepo.delete.mockResolvedValue({ affected: 1 });
      genRepoForIngestion.delete.mockResolvedValue({ affected: 1 });

      const result = await cleanupSvc.cleanupRetiredGenerations(24);

      // Qdrant: ลบ vectors ของ chunks ของ RETIRED generation
      expect(qdrantService.deleteByPointIds).toHaveBeenCalledWith([
        'chunk-old-1',
        'chunk-old-2',
      ]);
      // DB: ลบ chunks จาก MariaDB
      expect(chunkRepoForIngestion.delete).toHaveBeenCalledWith({
        generationUuid: OLD_GEN_UUID,
      });
      // DB: ลบ pages จาก MariaDB
      expect(cleanupPageRepo.delete).toHaveBeenCalledWith({
        generationUuid: OLD_GEN_UUID,
      });
      // DB: ลบ generation record
      expect(genRepoForIngestion.delete).toHaveBeenCalledWith({
        generationUuid: OLD_GEN_UUID,
      });
      expect(result).toEqual({
        cleanedGenerations: 1,
        deletedChunks: 2,
        deletedPages: 1,
        failedCleanups: 0,
      });
    });
  });
});
