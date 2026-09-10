// File: backend/test/rag-cross-project.e2e-spec.ts
// Change Log:
// - 2026-09-10: T037 — เพิ่ม E2E tests สำหรับ cross-Project Distribution denial (Feature 254, Phase 4 US2)

import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import request from 'supertest';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RbacGuard } from '../src/common/guards/rbac.guard';
import { PERMISSIONS_KEY } from '../src/common/decorators/require-permission.decorator';
import { Attachment } from '../src/common/file-storage/entities/attachment.entity';
import { RagAttachmentGeneration } from '../src/modules/ai/entities/rag-attachment-generation.entity';
import { RagAttachmentChunk } from '../src/modules/ai/entities/rag-attachment-chunk.entity';
import { RagAttachmentPage } from '../src/modules/ai/entities/rag-attachment-page.entity';
import { RagAttachmentController } from '../src/modules/ai/rag-attachment.controller';
import { RagGenerationService } from '../src/modules/ai/services/rag-generation.service';
import { RagAttachmentIngestionService } from '../src/modules/ai/services/rag-attachment-ingestion.service';
import { RagRetrievalService } from '../src/modules/ai/services/rag-retrieval.service';
import { RagRetrievalGuardService } from '../src/modules/ai/services/rag-retrieval-guard.service';
import { RagCitationService } from '../src/modules/ai/services/rag-citation.service';
import { RagGenerationLockService } from '../src/modules/ai/services/rag-generation-lock.service';
import { RagErrorService } from '../src/modules/ai/services/rag-error.service';
import { AiQueueService } from '../src/modules/ai/ai-queue.service';
import { OcrService } from '../src/modules/ai/services/ocr.service';
import { AiQdrantService } from '../src/modules/ai/qdrant.service';

/** Mock user ที่ JwtAuthGuard แปะเข้า request */
interface MockUser {
  user_id: number;
  permissions: string[];
}

const PROJECT_A = '019505a1-7c3e-7000-8000-aaa111aaa111';
const PROJECT_B = '019505a1-7c3e-7000-8000-bbb222bbb222';
const ATTACHMENT_A = '019505a1-7c3e-7000-8000-aaa333aaa333';
const ATTACHMENT_B = '019505a1-7c3e-7000-8000-bbb444bbb444';

/** สิทธิ์ RAG retrieval (ADR-023A) — แยกจาก Distribution */
const PERM_RAG_MANAGE = 'rag.manage';
/** สิทธิ์ Distribution (Circulation) — ไม่ใช่ RAG retrieval */
const PERM_DISTRIBUTE = 'correspondence.distribute';

/**
 * E2E tests สำหรับ cross-Project Distribution denial (Feature 254, T037)
 * ทดสอบ ADR-023A tenant isolation ที่ HTTP boundary:
 *   - Distribution access ไปยัง Project อื่น ไม่ทำให้สามารถ retrieve RAG ข้าม Project ได้
 *   - Qdrant filter บังคับ project_public_id เป็น must-condition เสมอ
 *
 * Mock: RagRetrievalService, AiQdrantService, OcrService, infra-dependent services
 * Override: JwtAuthGuard (แปะ mock user), RbacGuard (ตรวจสิทธิ์ตาม Reflector metadata)
 */
describe('RAG cross-Project Distribution denial (E2E) — Feature 254 T037', () => {
  let app: INestApplication;
  let currentUser: MockUser;

  /** Reflector ใช้ใน RbacGuard override เพื่ออ่าน @RequirePermission metadata */
  const reflector = new Reflector();

  const ingestionService = { ingest: jest.fn() };
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
        {
          provide: getRepositoryToken(RagAttachmentGeneration),
          useValue: {},
        },
        { provide: getRepositoryToken(RagAttachmentChunk), useValue: {} },
        { provide: getRepositoryToken(RagAttachmentPage), useValue: {} },
      ],
    })
      // JwtAuthGuard: แปะ mock user ลงใน request เพื่อให้ RbacGuard ตรวจสิทธิ์ได้
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext): boolean => {
          const req = context.switchToHttp().getRequest<{
            user?: MockUser;
          }>();
          req.user = currentUser;
          return true;
        },
      })
      // RbacGuard: จำลองการตรวจสิทธิ์ตาม @RequirePermission metadata เหมือนของจริง
      .overrideGuard(RbacGuard)
      .useValue({
        canActivate: (context: ExecutionContext): boolean => {
          const required = reflector.getAllAndOverride<string[]>(
            PERMISSIONS_KEY,
            [context.getHandler(), context.getClass()]
          );
          if (!required || required.length === 0) return true;
          const req = context.switchToHttp().getRequest<{
            user?: MockUser;
          }>();
          const user = req.user;
          if (!user) {
            throw new ForbiddenException('User not found in request');
          }
          const hasAll = required.every(
            (perm) =>
              user.permissions.includes(perm) ||
              user.permissions.includes('system.manage_all')
          );
          if (!hasAll) {
            throw new ForbiddenException(
              `You do not have permission: ${required.join(', ')}`
            );
          }
          return true;
        },
      })
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
    // default: ผู้ใช้มีสิทธิ์ rag.manage (override ในแต่ละ test ได้)
    currentUser = { user_id: 1, permissions: [PERM_RAG_MANAGE] };
    ocrService.embedViaSidecar.mockResolvedValue({
      dense: Array(1024).fill(0.1),
      sparse: { indices: [1], values: [0.5] },
    });
  });

  describe('POST /ai/rag/attachments/query — cross-Project isolation', () => {
    it('1. query projectPublicId=A คืนเฉพาะ chunks ของ project A เท่านั้น (ไม่มีของ project B)', async () => {
      // mock retrieval คืน citations ของ project A เท่านั้น (จำลอง Qdrant ที่กรอง project_public_id=A)
      retrievalService.retrieve.mockResolvedValue({
        citations: [
          {
            chunkPublicId: 'chunk-a-1',
            attachmentPublicId: ATTACHMENT_A,
            ownerType: 'CORRESPONDENCE',
            ownerPublicId: 'corr-a-1',
            content: 'content from project A',
            score: 0.95,
          },
        ],
        totalFound: 1,
        skippedStale: 0,
      });

      const res = await request(app.getHttpServer() as () => void)
        .post('/ai/rag/attachments/query')
        .send({ projectPublicId: PROJECT_A, query: 'test', topK: 5 })
        .expect(200);

      const body = res.body as Record<string, unknown>;
      const citations = body['citations'] as Array<Record<string, unknown>>;
      expect(citations).toHaveLength(1);
      // ทุก citation ต้องเป็นของ attachment ใน project A เท่านั้น
      expect(citations[0]['attachmentPublicId']).toBe(ATTACHMENT_A);
      expect(citations[0]['attachmentPublicId']).not.toBe(ATTACHMENT_B);
      // retrieval ถูกเรียกด้วย projectPublicId=A เท่านั้น (ไม่มี B ปน)
      expect(retrievalService.retrieve).toHaveBeenCalledWith(
        PROJECT_A,
        expect.any(Array),
        5
      );
      expect(retrievalService.retrieve).toHaveBeenCalledTimes(1);
      // ต้องไม่ถูกเรียกด้วย project B เด็ดขาด
      expect(retrievalService.retrieve).not.toHaveBeenCalledWith(
        PROJECT_B,
        expect.any(Array),
        expect.any(Number)
      );
    });

    it('2. ผู้ใช้มีสิทธิ์ Distribution ไป project B แต่ไม่มี rag.manage ไม่สามารถ query project A ได้ (403)', async () => {
      // ผู้ใช้มีสิทธิ์ Distribution แต่ไม่มี rag.manage → endpoint บังคับ rag.manage
      currentUser = { user_id: 2, permissions: [PERM_DISTRIBUTE] };

      await request(app.getHttpServer() as () => void)
        .post('/ai/rag/attachments/query')
        .send({ projectPublicId: PROJECT_A, query: 'test' })
        .expect(403);

      // retrieval ต้องไม่ถูกเรียกเลย (denied ที่ guard ก่อนถึง service)
      expect(retrievalService.retrieve).not.toHaveBeenCalled();
    });

    it('3. ผู้ใช้มีสิทธิ์ Distribution ไป project A แต่ไม่มี rag.manage ไม่สามารถ retrieve RAG chunks ของ project A ได้ (Distribution ≠ RAG retrieval)', async () => {
      // Distribution access ไป project A เอง ไม่เท่ากับสิทธิ์ RAG retrieval
      currentUser = { user_id: 3, permissions: [PERM_DISTRIBUTE] };

      await request(app.getHttpServer() as () => void)
        .post('/ai/rag/attachments/query')
        .send({ projectPublicId: PROJECT_A, query: 'test' })
        .expect(403);

      expect(retrievalService.retrieve).not.toHaveBeenCalled();
    });

    it('4. cross-project query คืน empty results เมื่อไม่มี chunks ของ project ที่ระบุ (ไม่รั่วข้าม Project)', async () => {
      // จำลอง Qdrant ที่กรอง project_public_id=A อย่างเคร่งครัด → ไม่มี chunks ของ B ปนเข้ามา
      retrievalService.retrieve.mockResolvedValue({
        citations: [],
        totalFound: 0,
        skippedStale: 0,
      });

      const res = await request(app.getHttpServer() as () => void)
        .post('/ai/rag/attachments/query')
        .send({ projectPublicId: PROJECT_A, query: 'test' })
        .expect(200);

      const body = res.body as Record<string, unknown>;
      expect(body['citations']).toEqual([]);
      expect(body['totalFound']).toBe(0);
      // retrieval ถูกเรียกด้วย project A เท่านั้น — ไม่มีทางดึง chunks ของ B ได้
      expect(retrievalService.retrieve).toHaveBeenCalledWith(
        PROJECT_A,
        expect.any(Array),
        10
      );
    });
  });

  /**
   * Test case 5: ตรวจสอบว่า Qdrant filter บังคับ project_public_id เป็น must-condition
   * ใช้ RagRetrievalService ของจริง + mock AiQdrantService เพื่อยืนยัน contract ที่ service layer
   * (แยก app เพราะต้องใช้ retrieval service จริง ไม่ใช่ mock)
   */
  describe('Qdrant filter — project_public_id mandatory must-condition', () => {
    let filterApp: INestApplication;
    const qdrantService = { search: jest.fn() };
    const filterOcrService = { embedViaSidecar: jest.fn() };
    const chunkRepository: Partial<Repository<RagAttachmentChunk>> = {
      find: jest.fn().mockResolvedValue([]),
    };
    const generationRepository: Partial<Repository<RagAttachmentGeneration>> = {
      find: jest.fn().mockResolvedValue([]),
    };

    beforeAll(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [RagAttachmentController],
        providers: [
          {
            provide: RagAttachmentIngestionService,
            useValue: { ingest: jest.fn() },
          },
          {
            provide: RagGenerationService,
            useValue: {
              getStatus: jest.fn(),
              overrideClassification: jest.fn(),
            },
          },
          // ใช้ RagRetrievalService ของจริงเพื่อยืนยันว่าส่ง projectPublicId ไป Qdrant
          RagRetrievalService,
          RagRetrievalGuardService,
          RagCitationService,
          { provide: OcrService, useValue: filterOcrService },
          { provide: AiQdrantService, useValue: qdrantService },
          {
            provide: AiQueueService,
            useValue: { enqueueRagAttachmentIngestion: jest.fn() },
          },
          { provide: RagGenerationLockService, useValue: {} },
          { provide: RagErrorService, useValue: new RagErrorService() },
          { provide: DataSource, useValue: {} },
          { provide: getRepositoryToken(Attachment), useValue: {} },
          {
            provide: getRepositoryToken(RagAttachmentGeneration),
            useValue: generationRepository,
          },
          {
            provide: getRepositoryToken(RagAttachmentChunk),
            useValue: chunkRepository,
          },
          { provide: getRepositoryToken(RagAttachmentPage), useValue: {} },
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue({ canActivate: () => true })
        .overrideGuard(RbacGuard)
        .useValue({ canActivate: () => true })
        .compile();

      filterApp = module.createNestApplication();
      filterApp.useGlobalPipes(new ValidationPipe({ transform: true }));
      await filterApp.init();
    });

    afterAll(async () => {
      await filterApp.close();
    });

    beforeEach(() => {
      jest.clearAllMocks();
      filterOcrService.embedViaSidecar.mockResolvedValue({
        dense: Array(1024).fill(0.1),
        sparse: { indices: [1], values: [0.5] },
      });
      // Qdrant คืน empty → retrieval จะ return empty โดยไม่ไปแตะ repositories
      qdrantService.search.mockResolvedValue([]);
    });

    it('5. Qdrant search ถูกเรียกด้วย project_public_id เป็น mandatory scope (must-condition)', async () => {
      await request(filterApp.getHttpServer() as () => void)
        .post('/ai/rag/attachments/query')
        .send({ projectPublicId: PROJECT_A, query: 'test', topK: 5 })
        .expect(200);

      // RagRetrievalService.retrieve ส่ง projectPublicId เป็น arg แรกของ qdrantService.search เสมอ
      // (topK*2 = 10 เป็น arg ที่สาม ตาม retrieve → search(projectPublicId, dense, topK*2))
      expect(qdrantService.search).toHaveBeenCalledTimes(1);
      expect(qdrantService.search).toHaveBeenCalledWith(
        PROJECT_A,
        expect.any(Array),
        10
      );
      // ต้องไม่ถูกเรียกด้วย project B — project_public_id เป็น mandatory must-condition
      expect(qdrantService.search).not.toHaveBeenCalledWith(
        PROJECT_B,
        expect.any(Array),
        expect.any(Number)
      );
    });

    it('5b. RagRetrievalService.retrieve ปฏิเสธ projectPublicId ว่าง (บังคับ project scope)', async () => {
      const retrieval = new RagRetrievalService(
        chunkRepository as Repository<RagAttachmentChunk>,
        generationRepository as Repository<RagAttachmentGeneration>,
        qdrantService as unknown as AiQdrantService
      );
      // เรียกตรงด้วย projectPublicId ว่าง → ต้อง throw (mandatory must-condition enforcement)
      await expect(
        retrieval.retrieve('', new Array<number>(1024).fill(0.1), 5)
      ).rejects.toThrow('RAG_RETRIEVAL_PROJECT_SCOPE_REQUIRED');
      // Qdrant ต้องไม่ถูกเรียกเมื่อ scope ว่าง
      expect(qdrantService.search).not.toHaveBeenCalled();
    });
  });
});
