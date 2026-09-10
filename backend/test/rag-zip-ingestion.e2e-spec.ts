// File: backend/test/rag-zip-ingestion.e2e-spec.ts
// Change Log:
// - 2026-09-14: T057 — เพิ่ม E2E fixture tests สำหรับ ZIP sourceLocator citations (Feature 254, Phase 6 US4)

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { Job } from 'bullmq';
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
import { RagCitationService } from '../src/modules/ai/services/rag-citation.service';
import { RagGenerationLockService } from '../src/modules/ai/services/rag-generation-lock.service';
import { RagErrorService } from '../src/modules/ai/services/rag-error.service';
import { AiQueueService } from '../src/modules/ai/ai-queue.service';
import { OcrService } from '../src/modules/ai/services/ocr.service';
import { RagAttachmentIngestProcessor } from '../src/modules/ai/processors/rag-attachment-ingest.processor';
import { RagTextSegmentService } from '../src/modules/ai/services/rag-text-segment.service';
import { RagChunkingService } from '../src/modules/ai/services/rag-chunking.service';
import { RagAttachmentSourceService } from '../src/modules/ai/services/rag-attachment-source.service';
import { RagEmbeddingService } from '../src/modules/ai/services/rag-embedding.service';
import { SecureArchiveService } from '../src/common/file-storage/secure-archive.service';
import { ClamAVService } from '../src/common/clamav/clamav.service';
import AdmZip from 'adm-zip';
import * as fs from 'fs';
import {
  AiQdrantService,
  AiVectorSearchResult,
} from '../src/modules/ai/qdrant.service';
import type { RagAttachmentIngestJobPayload } from '../src/modules/ai/ai-queue.service';

const ATTACHMENT_ID = '019505a1-7c3e-7000-8000-abc123def456';
const PROJECT_ID = '019505a1-7c3e-7000-8000-aab123def456';
const GEN_UUID = '019505a1-7c3e-7000-8000-gen001zip0001';
const CHECKSUM = 'a'.repeat(64);

/**
 * E2E fixture tests สำหรับ ZIP sourceLocator citations (Feature 254, T057, Phase 6 US4)
 * ทดสอบผ่าน NestJS DI + supertest โดยใช้ real ingestion service + mock infra services
 *
 * ครอบคลุม:
 *   1. Ingest ZIP → processor สร้าง chunks ที่มี sourceLocator ชี้ไปยัง inner file path
 *   2. Query คืน citations ที่มี sourceLocator สำหรับ ZIP-derived chunks
 *   3. ZIP inner file citation มี segmentType (PAGE/SECTION/SHEET)
 *   4. Citation ไม่เปิดเผย generationUuid
 *   5. Rejected ZIP (path traversal) คืน 400 พร้อม user-safe error
 *   6. Rejected ZIP (encrypted) คืน 400 พร้อม user-safe error
 *
 * Mock: RagRetrievalService, OcrService, AiQueueService (infra-dependent services)
 * Real: RagAttachmentIngestionService, RagCitationService, RagTextSegmentService,
 *       RagChunkingService, RagAttachmentIngestProcessor (business logic)
 * Override: JwtAuthGuard, RbacGuard (pass-through)
 *
 * TDD: tests 1, 3, 5, 6 คาดว่าจะ RED เพราะ SecureArchiveService (T060) ยังไม่มี
 *      และ citation DTO ยังไม่มี segmentType field — implementation ใน T058-T061 จะทำให้ GREEN
 */
describe('RAG ZIP ingestion citations (E2E) — Feature 254 T057', () => {
  // -------------------------------------------------------------------------
  // HTTP boundary — ใช้ real RagAttachmentIngestionService + mock retrieval/ocr/queue
  // ทดสอบ ingest rejection + query citation contract ที่ HTTP boundary
  // -------------------------------------------------------------------------
  describe('HTTP boundary — ZIP ingest + query citations', () => {
    let app: INestApplication;

    /** mock repos สำหรับ real RagAttachmentIngestionService */
    const attachmentRepository = {
      findOne: jest.fn(),
    };
    const generationRepository = {
      findOne: jest.fn(),
      create: jest.fn(
        (value: Partial<RagAttachmentGeneration>) =>
          ({ ...value }) as RagAttachmentGeneration
      ),
      save: jest.fn(),
    };
    const chunkRepository = {
      count: jest.fn().mockResolvedValue(0),
    };
    const lock = { release: jest.fn().mockResolvedValue(undefined) };
    const lockService = {
      acquire: jest.fn().mockResolvedValue(lock),
    };

    /** mock infra-dependent services */
    const generationService = {
      getStatus: jest.fn(),
      overrideClassification: jest.fn(),
    };
    const retrievalService = { retrieve: jest.fn() };
    const ocrService = { embedViaSidecar: jest.fn() };
    const aiQueueService = { enqueueRagAttachmentIngestion: jest.fn() };

    beforeAll(async () => {
      // สร้าง unsafe ZIP fixtures สำหรับ tests 5 และ 6
      // adm-zip normalizes ../, so we build raw ZIP bytes to preserve dangerous paths
      const makeRawZip = (entryName: string, content: string): Buffer => {
        const nameBuf = Buffer.from(entryName, 'latin1');
        const contentBuf = Buffer.from(content);
        let crc = 0xffffffff;
        for (const b of contentBuf) {
          crc ^= b;
          for (let i = 0; i < 8; i++)
            crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
        }
        crc = (crc ^ 0xffffffff) >>> 0;
        const lf = Buffer.alloc(30);
        lf.writeUInt32LE(0x04034b50, 0);
        lf.writeUInt16LE(20, 4);
        lf.writeUInt32LE(crc, 14);
        lf.writeUInt32LE(contentBuf.length, 18);
        lf.writeUInt32LE(contentBuf.length, 22);
        lf.writeUInt16LE(nameBuf.length, 26);
        const localData = Buffer.concat([lf, nameBuf, contentBuf]);
        const cd = Buffer.alloc(46);
        cd.writeUInt32LE(0x02014b50, 0);
        cd.writeUInt16LE(20, 4);
        cd.writeUInt16LE(20, 6);
        cd.writeUInt32LE(crc, 16);
        cd.writeUInt32LE(contentBuf.length, 20);
        cd.writeUInt32LE(contentBuf.length, 24);
        cd.writeUInt16LE(nameBuf.length, 28);
        cd.writeUInt32LE(0, 42);
        const cdData = Buffer.concat([cd, nameBuf]);
        const eocd = Buffer.alloc(22);
        eocd.writeUInt32LE(0x06054b50, 0);
        eocd.writeUInt16LE(1, 8);
        eocd.writeUInt16LE(1, 10);
        eocd.writeUInt32LE(cdData.length, 12);
        eocd.writeUInt32LE(localData.length, 16);
        return Buffer.concat([localData, cdData, eocd]);
      };
      fs.writeFileSync(
        '/tmp/unsafe.zip',
        makeRawZip('../escape.pdf', 'escape')
      );

      // encrypted ZIP — set encryption bit flag in raw bytes
      const encryptedZip = new AdmZip();
      encryptedZip.addFile('doc.pdf', Buffer.from('encrypted'));
      const encryptedBuf = encryptedZip.toBuffer();
      const lfSig = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
      const lfOffset = encryptedBuf.indexOf(lfSig);
      if (lfOffset !== -1) {
        encryptedBuf.writeUInt16LE(
          encryptedBuf.readUInt16LE(lfOffset + 6) | 0x0001,
          lfOffset + 6
        );
      }
      const cdSig = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
      const cdOffset = encryptedBuf.indexOf(cdSig);
      if (cdOffset !== -1) {
        encryptedBuf.writeUInt16LE(
          encryptedBuf.readUInt16LE(cdOffset + 8) | 0x0001,
          cdOffset + 8
        );
      }
      fs.writeFileSync('/tmp/encrypted.zip', encryptedBuf);

      const module: TestingModule = await Test.createTestingModule({
        controllers: [RagAttachmentController],
        providers: [
          // real ingestion service — เพื่อทดสอบว่ายังไม่ validate ZIP security (RED)
          RagAttachmentIngestionService,
          SecureArchiveService,
          {
            provide: ClamAVService,
            useValue: {
              scanFile: jest.fn().mockResolvedValue({ isInfected: false }),
            },
          },
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue(undefined) },
          },
          { provide: RagGenerationService, useValue: generationService },
          { provide: RagRetrievalService, useValue: retrievalService },
          { provide: OcrService, useValue: ocrService },
          { provide: AiQueueService, useValue: aiQueueService },
          { provide: RagGenerationLockService, useValue: lockService },
          { provide: RagErrorService, useValue: new RagErrorService() },
          { provide: DataSource, useValue: {} },
          {
            provide: getRepositoryToken(Attachment),
            useValue: attachmentRepository,
          },
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

      app = module.createNestApplication();
      app.useGlobalPipes(new ValidationPipe({ transform: true }));
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    beforeEach(() => {
      jest.clearAllMocks();
      // re-stub ค่าที่ clearAllMocks ลบไป
      lockService.acquire.mockResolvedValue(lock);
      lock.release.mockResolvedValue(undefined);
      chunkRepository.count.mockResolvedValue(0);
      ocrService.embedViaSidecar.mockResolvedValue({
        dense: Array(1024).fill(0.1),
        sparse: { indices: [1], values: [0.5] },
      });
    });

    // -----------------------------------------------------------------------
    // Test 2: Query คืน citations ที่มี sourceLocator สำหรับ ZIP-derived chunks
    // -----------------------------------------------------------------------
    it('2. query คืน citations ที่มี sourceLocator ชี้ไปยัง inner file path ของ ZIP', async () => {
      retrievalService.retrieve.mockResolvedValue({
        citations: [
          {
            chunkPublicId: 'chunk-zip-1',
            attachmentPublicId: ATTACHMENT_ID,
            ownerType: 'CORRESPONDENCE',
            ownerPublicId: 'corr-1',
            content: 'content from inner file docs/spec.pdf',
            segmentNumber: 1,
            segmentLabel: 'docs/spec.pdf',
            sourceLocator: 'docs/spec.pdf',
            score: 0.91,
          },
        ],
        totalFound: 1,
        skippedStale: 0,
      });

      const res = await request(app.getHttpServer() as () => void)
        .post('/ai/rag/attachments/query')
        .send({ projectPublicId: PROJECT_ID, query: 'spec', topK: 5 })
        .expect(200);

      const body = res.body as Record<string, unknown>;
      const citations = body['citations'] as Array<Record<string, unknown>>;
      expect(citations).toHaveLength(1);
      // sourceLocator ต้องชี้ไปยัง inner file path ของ ZIP
      expect(citations[0]['sourceLocator']).toBe('docs/spec.pdf');
      expect(retrievalService.retrieve).toHaveBeenCalledWith(
        PROJECT_ID,
        expect.any(Array),
        5
      );
    });

    // -----------------------------------------------------------------------
    // Test 4: Citation ไม่เปิดเผย generationUuid
    // -----------------------------------------------------------------------
    it('4. citation ไม่เปิดเผย generationUuid ใน response ของ query', async () => {
      retrievalService.retrieve.mockResolvedValue({
        citations: [
          {
            chunkPublicId: 'chunk-zip-2',
            attachmentPublicId: ATTACHMENT_ID,
            ownerType: 'CORRESPONDENCE',
            ownerPublicId: 'corr-1',
            content: 'content from inner file drawings/d1.pdf',
            sourceLocator: 'drawings/d1.pdf',
            score: 0.88,
          },
        ],
        totalFound: 1,
        skippedStale: 0,
      });

      const res = await request(app.getHttpServer() as () => void)
        .post('/ai/rag/attachments/query')
        .send({ projectPublicId: PROJECT_ID, query: 'drawing', topK: 5 })
        .expect(200);

      const body = res.body as Record<string, unknown>;
      const citations = body['citations'] as Array<Record<string, unknown>>;
      expect(citations).toHaveLength(1);
      expect(citations[0]).not.toHaveProperty('generationUuid');
    });

    // -----------------------------------------------------------------------
    // Test 5: Rejected ZIP (path traversal) คืน 400 — RED (SecureArchiveService ยังไม่มี)
    // -----------------------------------------------------------------------
    it('5. rejected ZIP (path traversal) คืน 400 พร้อม user-safe error', async () => {
      // attachment เป็น ZIP ที่มี path traversal entry (เช่น ../../etc/passwd)
      attachmentRepository.findOne.mockResolvedValue({
        publicId: ATTACHMENT_ID,
        originalFilename: 'unsafe.zip',
        storedFilename: 'unsafe.zip',
        filePath: '/tmp/unsafe.zip',
        mimeType: 'application/zip',
        fileSize: 1024,
        checksum: CHECKSUM,
        classification: 'INTERNAL',
        ocrText: 'some text',
      } as Attachment);
      generationRepository.findOne.mockResolvedValue(null);
      generationRepository.save.mockResolvedValue({
        generationUuid: GEN_UUID,
        attachmentUuid: ATTACHMENT_ID,
        attachmentChecksumSnapshot: CHECKSUM,
        status: 'BUILDING',
      });
      aiQueueService.enqueueRagAttachmentIngestion.mockResolvedValue('job-1');

      // คาดว่า ingest จะตรวจพบ path traversal และปฏิเสธด้วย 400 (user-safe error)
      // ปัจจุบัน ingestion service ยังไม่ validate ZIP security → คืน 202 → RED
      const res = await request(app.getHttpServer() as () => void)
        .post(`/ai/rag/attachments/${ATTACHMENT_ID}/ingest`)
        .set('Idempotency-Key', 'req-traversal-1')
        .send({ force: false });

      // คาดหวัง 400 แต่ปัจจุบันได้ 202 (RED — SecureArchiveService ยังไม่ implement)
      expect(res.status).toBe(400);
      const body = res.body as Record<string, unknown>;
      // error response ต้องไม่เปิดเผย technical detail (user-safe)
      const errorPayload = (body['error'] ?? body) as Record<string, unknown>;
      const msg = errorPayload['message'];
      const msgStr = Array.isArray(msg)
        ? msg.join(' ')
        : typeof msg === 'string'
          ? msg
          : '';
      expect(msgStr).not.toContain('/etc/passwd');
    });

    // -----------------------------------------------------------------------
    // Test 6: Rejected ZIP (encrypted) คืน 400 — RED (SecureArchiveService ยังไม่มี)
    // -----------------------------------------------------------------------
    it('6. rejected ZIP (encrypted) คืน 400 พร้อม user-safe error', async () => {
      // attachment เป็น ZIP ที่เข้ารหัส (encrypted)
      attachmentRepository.findOne.mockResolvedValue({
        publicId: ATTACHMENT_ID,
        originalFilename: 'encrypted.zip',
        storedFilename: 'encrypted.zip',
        filePath: '/tmp/encrypted.zip',
        mimeType: 'application/zip',
        fileSize: 2048,
        checksum: CHECKSUM,
        classification: 'INTERNAL',
        ocrText: 'some text',
      } as Attachment);
      generationRepository.findOne.mockResolvedValue(null);
      generationRepository.save.mockResolvedValue({
        generationUuid: GEN_UUID,
        attachmentUuid: ATTACHMENT_ID,
        attachmentChecksumSnapshot: CHECKSUM,
        status: 'BUILDING',
      });
      aiQueueService.enqueueRagAttachmentIngestion.mockResolvedValue('job-2');

      // คาดว่า ingest จะตรวจพบ encrypted archive และปฏิเสธด้วย 400 (user-safe error)
      // ปัจจุบัน ingestion service ยังไม่ validate ZIP security → คืน 202 → RED
      const res = await request(app.getHttpServer() as () => void)
        .post(`/ai/rag/attachments/${ATTACHMENT_ID}/ingest`)
        .set('Idempotency-Key', 'req-encrypted-1')
        .send({ force: false });

      // คาดหวัง 400 แต่ปัจจุบันได้ 202 (RED — SecureArchiveService ยังไม่ implement)
      expect(res.status).toBe(400);
      const body = res.body as Record<string, unknown>;
      const errorPayload = (body['error'] ?? body) as Record<string, unknown>;
      const msg = errorPayload['message'];
      const msgStr = Array.isArray(msg)
        ? msg.join(' ')
        : typeof msg === 'string'
          ? msg
          : '';
      expect(msgStr).not.toContain('decrypt');
    });
  });

  // -------------------------------------------------------------------------
  // Service-level: processor สร้าง chunks ที่มี sourceLocator สำหรับ ZIP inner files
  // ใช้ real processor + mock repos/infra — RED เพราะ processor ยังใช้ normalizeWholeDocument
  // -------------------------------------------------------------------------
  describe('processor — ZIP inner-file chunks carry sourceLocator', () => {
    let processor: RagAttachmentIngestProcessor;

    /** mock repos สำหรับ processor */
    const attachmentRepository = {
      findOne: jest.fn(),
    };
    const generationRepository = {
      findOne: jest.fn(),
    };
    const pageRepository = {
      create: jest.fn(
        (value: Partial<RagAttachmentPage>) =>
          ({ ...value }) as RagAttachmentPage
      ),
      save: jest.fn().mockResolvedValue(undefined),
    };
    /** capture chunks ที่ถูก create + save เพื่อตรวจสอบ sourceLocator */
    const savedChunks: RagAttachmentChunk[] = [];
    const chunkRepository = {
      create: jest.fn(
        (value: Partial<RagAttachmentChunk>) =>
          ({ ...value }) as RagAttachmentChunk
      ),
      save: jest.fn((chunks: RagAttachmentChunk[]) => {
        savedChunks.push(...chunks);
        return Promise.resolve(chunks);
      }),
      count: jest.fn().mockResolvedValue(0),
    };

    /** mock ingestion service (markVerified/activate/markFailed) */
    const ingestionService = {
      markVerified: jest.fn().mockResolvedValue(undefined),
      activate: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
    };

    /** mock attachment source service */
    const attachmentSourceService = {
      resolveFromAttachment: jest.fn().mockResolvedValue({
        ownerType: 'CORRESPONDENCE',
        ownerPublicId: 'corr-1',
        projectPublicId: PROJECT_ID,
      }),
    };

    /** mock embedding service (infra-dependent) */
    const embeddingService = {
      embedChunk: jest.fn().mockResolvedValue({
        dense: Array(1024).fill(0.1),
        sparse: { indices: [1], values: [0.5] },
      }),
      buildQdrantPoint: jest.fn().mockReturnValue({
        id: 'point-1',
        vector: {
          bge_dense: Array(1024).fill(0.1),
          bge_sparse: { indices: [1], values: [0.5] },
        },
        payload: {},
      }),
    };

    /** mock Qdrant service (infra-dependent) */
    const qdrantService = { upsert: jest.fn().mockResolvedValue(undefined) };

    beforeAll(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RagAttachmentIngestProcessor,
          RagTextSegmentService,
          RagChunkingService,
          { provide: ConfigService, useValue: { get: () => 512 } },
          {
            provide: RagAttachmentIngestionService,
            useValue: ingestionService,
          },
          {
            provide: RagAttachmentSourceService,
            useValue: attachmentSourceService,
          },
          { provide: RagEmbeddingService, useValue: embeddingService },
          { provide: AiQdrantService, useValue: qdrantService },
          {
            provide: getRepositoryToken(Attachment),
            useValue: attachmentRepository,
          },
          {
            provide: getRepositoryToken(RagAttachmentGeneration),
            useValue: generationRepository,
          },
          {
            provide: getRepositoryToken(RagAttachmentPage),
            useValue: pageRepository,
          },
          {
            provide: getRepositoryToken(RagAttachmentChunk),
            useValue: chunkRepository,
          },
        ],
      }).compile();

      processor = module.get<RagAttachmentIngestProcessor>(
        RagAttachmentIngestProcessor
      );
    });

    beforeEach(() => {
      jest.clearAllMocks();
      savedChunks.length = 0;
      // re-stub ค่าที่ clearAllMocks ลบไป
      pageRepository.save.mockResolvedValue(undefined);
      chunkRepository.save.mockImplementation(
        (chunks: RagAttachmentChunk[]) => {
          savedChunks.push(...chunks);
          return Promise.resolve(chunks);
        }
      );
      chunkRepository.count.mockResolvedValue(0);
      ingestionService.markVerified.mockResolvedValue(undefined);
      ingestionService.activate.mockResolvedValue(undefined);
      ingestionService.markFailed.mockResolvedValue(undefined);
      attachmentSourceService.resolveFromAttachment.mockResolvedValue({
        ownerType: 'CORRESPONDENCE',
        ownerPublicId: 'corr-1',
        projectPublicId: PROJECT_ID,
      });
      embeddingService.embedChunk.mockResolvedValue({
        dense: Array(1024).fill(0.1),
        sparse: { indices: [1], values: [0.5] },
      });
      qdrantService.upsert.mockResolvedValue(undefined);
    });

    // -----------------------------------------------------------------------
    // Test 1: Ingest ZIP → processor สร้าง chunks ที่มี sourceLocator ชี้ไปยัง inner file path
    // RED: processor ปัจจุบันใช้ normalizeWholeDocument → WHOLE_DOCUMENT, ไม่มี sourceLocator
    // -----------------------------------------------------------------------
    it('1. ingest ZIP attachment → สร้าง chunks ที่มี sourceLocator ชี้ไปยัง inner file path', async () => {
      // generation อยู่ในสถานะ BUILDING
      generationRepository.findOne.mockResolvedValue({
        generationUuid: GEN_UUID,
        attachmentUuid: ATTACHMENT_ID,
        attachmentChecksumSnapshot: CHECKSUM,
        status: 'BUILDING',
      });

      // attachment เป็น ZIP ที่มี inner files (ocrText จำลองจาก inner files)
      attachmentRepository.findOne.mockResolvedValue({
        publicId: ATTACHMENT_ID,
        originalFilename: 'archive.zip',
        storedFilename: 'archive.zip',
        filePath: '/tmp/archive.zip',
        mimeType: 'application/zip',
        fileSize: 4096,
        checksum: CHECKSUM,
        classification: 'INTERNAL',
        ocrText: 'content from docs/spec.pdf and drawings/d1.pdf',
      } as Attachment);

      const job = {
        data: {
          attachmentPublicId: ATTACHMENT_ID,
          attachmentChecksum: CHECKSUM,
          force: false,
        },
      } as Job<RagAttachmentIngestJobPayload>;

      await processor.process(job);

      // processor ต้องสร้าง chunks ที่มี sourceLocator ชี้ไปยัง inner file path
      // เช่น "docs/spec.pdf", "drawings/d1.pdf"
      // ปัจจุบัน processor ใช้ normalizeWholeDocument → segmentType WHOLE_DOCUMENT,
      // ไม่มี sourceLocator → RED
      expect(savedChunks.length).toBeGreaterThan(0);
      const locators = savedChunks
        .map((c) => c.sourceLocator)
        .filter((loc): loc is string => Boolean(loc));
      // อย่างน้อยหนึ่ง chunk ต้องมี sourceLocator ที่ชี้ไปยัง inner file path
      expect(locators.length).toBeGreaterThan(0);
      // sourceLocator ต้องมีลักษณะเป็น inner file path (มี / หรือนามสกุลไฟล์)
      expect(locators.some((loc) => loc.includes('.pdf'))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Service-level: citation มี segmentType สำหรับ ZIP inner files
  // ใช้ real RagCitationService — RED เพราะ RagCitationDto ยังไม่มี segmentType field
  // -------------------------------------------------------------------------
  describe('citation service — ZIP inner-file segmentType', () => {
    let citationService: RagCitationService;

    beforeAll(() => {
      citationService = new RagCitationService();
    });

    // -----------------------------------------------------------------------
    // Test 3: ZIP inner file citation มี segmentType (PAGE/SECTION/SHEET)
    // RED: RagCitationDto และ mapToCitations ยังไม่ include segmentType
    // -----------------------------------------------------------------------
    it('3. ZIP inner file citation มี segmentType (PAGE/SECTION/SHEET)', () => {
      const chunkMap = new Map<string, RagAttachmentChunk>([
        [
          'chunk-page-1',
          {
            chunkPublicId: 'chunk-page-1',
            generationUuid: GEN_UUID,
            attachmentUuid: ATTACHMENT_ID,
            chunkIndex: 0,
            content: 'page 1 content from docs/spec.pdf',
            sourcePageUuid: 'page-1',
            segmentType: 'PAGE',
            segmentNumber: 1,
            segmentLabel: 'docs/spec.pdf — Page 1',
            sourceLocator: 'docs/spec.pdf',
            startOffset: '0',
            endOffset: '100',
            classification: 'INTERNAL',
            ownerType: 'CORRESPONDENCE',
            ownerPublicId: 'corr-1',
            projectPublicId: PROJECT_ID,
          } as RagAttachmentChunk,
        ],
      ]);

      const rawResults: AiVectorSearchResult[] = [
        {
          pointId: 'p-chunk-page-1',
          score: 0.93,
          payload: {
            chunk_public_id: 'chunk-page-1',
            generation_uuid: GEN_UUID,
          },
        },
      ];

      const { citations } = citationService.mapToCitations(
        rawResults,
        chunkMap,
        10
      );

      expect(citations).toHaveLength(1);
      // citation ต้องมี segmentType ที่บอกประเภท source unit ของ inner file
      // ปัจจุบัน RagCitationDto ยังไม่มี segmentType field → RED
      expect(citations[0]).toHaveProperty('segmentType');
      const segmentType = (citations[0] as Record<string, unknown>)[
        'segmentType'
      ] as string | undefined;
      expect(['PAGE', 'SECTION', 'SHEET']).toContain(segmentType);
    });
  });
});
