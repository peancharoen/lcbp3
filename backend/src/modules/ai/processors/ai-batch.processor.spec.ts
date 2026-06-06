// File: src/modules/ai/processors/ai-batch.processor.spec.ts
// Change Log
// - 2026-05-21: สร้าง Unit Test สำหรับ AiBatchProcessor ครอบคลุม embed-document และ sandbox-rag (T032).
// - 2026-05-21: เพิ่มการทดสอบ sandbox-extract พร้อม mock OcrService, OllamaService และ Redis (T039).
// - 2026-05-21: แก้ไข ESLint unexpected any และ unsafe member access โดยกำหนด type ให้ redis เป็น Record<string, jest.Mock>
// - 2026-05-22: เพิ่ม Mock dependencies (ProjectRepository, AiAuditLogRepository, TagsService, MigrationService) เพื่อแก้ปัญหา Nest resolve dependency ใน unit test และปรับโครงสร้างฟังก์ชันไม่มีบรรทัดว่าง (Zero Blank Lines) ตามกฎเหล็ก
// - 2026-05-27: เพิ่ม Mock สำหรับ getActive และ resolveContext ของ AiPromptsService เพื่อรองรับ Context-Aware Prompt (T017)
// - 2026-05-28: เพิ่ม test สำหรับ EC-001 (NEW_TAG_SUGGESTED) และ EC-002 (UNRESOLVED_SENDER/RECIPIENT_UUID)
// - 2026-05-29: แก้ไข mockAttachmentRepo เพิ่ม property manager เพื่อรองรับ jest.spyOn ใน EC-001, EC-002, และ migrate-document tests
// - 2026-06-03: ADR-034 — เพิ่ม OCR_JOB_TYPES import, mock unloadModel/loadModel/getOcrModelName, อัปเดต getMainModelName เป็น typhoon2.5, เพิ่ม test ocr-extract model switching

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import {
  AiBatchProcessor,
  AiBatchJobData,
  OCR_JOB_TYPES,
} from './ai-batch.processor';
import { EmbeddingService } from '../services/embedding.service';
import { AiRagService } from '../ai-rag.service';
import { Attachment } from '../../../common/file-storage/entities/attachment.entity';
import { OcrService } from '../services/ocr.service';
import { SandboxOcrEngineService } from '../services/sandbox-ocr-engine.service';
import { OllamaService } from '../services/ollama.service';
import { Project } from '../../project/entities/project.entity';
import { AiAuditLog } from '../entities/ai-audit-log.entity';
import { TagsService } from '../../tags/tags.service';
import { MigrationService } from '../../migration/migration.service';
import { AiPromptsService } from '../prompts/ai-prompts.service';

describe('AiBatchProcessor', () => {
  let processor: AiBatchProcessor;
  let embeddingService: jest.Mocked<EmbeddingService>;
  let ragService: jest.Mocked<AiRagService>;
  let ocrService: jest.Mocked<OcrService>;
  let sandboxOcrEngineService: jest.Mocked<SandboxOcrEngineService>;
  let ollamaService: jest.Mocked<OllamaService>;
  let redis: Record<string, jest.Mock>;
  let attachmentRepo: jest.Mocked<Repository<Attachment>>;
  const DEFAULT_REDIS_TOKEN = 'default_IORedisModuleConnectionToken';
  const mockEmbeddingService = {
    embedDocument: jest
      .fn()
      .mockResolvedValue({ success: true, chunksEmbedded: 5 }),
  };
  const mockRagService = {
    processQuery: jest.fn().mockResolvedValue(undefined),
  };
  const mockOcrService = {
    detectAndExtract: jest
      .fn()
      .mockResolvedValue({ text: 'OCR text LCBP3-CIV-001 Civil' }),
    processWithAutoDetect: jest.fn().mockResolvedValue({
      text: 'extracted ocr text from document that is long enough to bypass character length check',
    }),
  };
  const mockSandboxOcrEngineService = {
    detectAndExtract: jest.fn().mockResolvedValue({
      text: 'OCR text LCBP3-CIV-001 Civil',
      ocrUsed: true,
      engineUsed: 'typhoon-np-dms-ocr',
      fallbackUsed: false,
    }),
  };
  const mockOllamaService = {
    getMainModelName: jest.fn().mockReturnValue('typhoon2.5-np-dms:latest'),
    getOcrModelName: jest.fn().mockReturnValue('typhoon-np-dms-ocr:latest'),
    loadModel: jest.fn().mockResolvedValue(true),
    unloadModel: jest.fn().mockResolvedValue(true),
    generate: jest.fn().mockResolvedValue(
      JSON.stringify({
        documentNumber: 'LCBP3-CIV-001',
        subject: 'Foundation Inspection Report',
        discipline: 'Civil',
        category: 'Correspondence',
        date: '2026-05-20',
        confidence: 0.95,
        tags: ['foundation'],
        summary: 'summary text',
      })
    ),
  };
  const mockRedis = {
    setex: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
  };
  const mockAttachmentRepo = {
    findOne: jest.fn().mockResolvedValue({
      id: 1,
      publicId: 'doc-uuid-123',
      filePath: '/files/test.pdf',
      uploadedByUserId: 10,
    }),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    manager: {},
  };
  const mockProjectRepo = {
    findOne: jest.fn().mockResolvedValue({
      id: 2,
      publicId: 'proj-uuid-456',
    }),
  };
  const mockAiAuditLogRepo = {
    create: jest.fn().mockReturnValue({}),
    save: jest.fn().mockResolvedValue({}),
  };
  const mockTagsService = {
    findOrCreateTags: jest
      .fn()
      .mockResolvedValue([
        { id: 5, publicId: 'tag-uuid-999', tagName: 'foundation' },
      ]),
    findOrSuggestTags: jest.fn().mockResolvedValue([
      {
        tag: { id: 5, publicId: 'tag-uuid-999', tagName: 'foundation' },
        isNew: false,
      },
    ]),
  };
  const mockMigrationService = {
    createError: jest.fn().mockResolvedValue(undefined),
    enqueueRecord: jest.fn().mockResolvedValue(undefined),
  };
  const mockAiPromptsService = {
    getActive: jest.fn().mockResolvedValue({
      id: 1,
      promptType: 'ocr_extraction',
      versionNumber: 2,
      template:
        'Resolved test prompt with OCR text {{ocr_text}} and context {{master_data_context}}',
      isActive: true,
      contextConfig: { filter: {} },
    }),
    resolveContext: jest.fn().mockResolvedValue({
      availableProjects: [],
      availableOrganizations: [],
      availableDisciplines: [],
      availableCorrespondenceTypes: [],
      availableTags: [],
    }),
    resolveActive: jest.fn().mockResolvedValue({
      resolvedPrompt: 'Resolved test prompt with OCR text',
      versionNumber: 2,
    }),
    findByVersion: jest.fn().mockResolvedValue(null),
    saveTestResult: jest.fn().mockResolvedValue(undefined),
  };
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiBatchProcessor,
        { provide: EmbeddingService, useValue: mockEmbeddingService },
        { provide: AiRagService, useValue: mockRagService },
        { provide: OcrService, useValue: mockOcrService },
        {
          provide: SandboxOcrEngineService,
          useValue: mockSandboxOcrEngineService,
        },
        { provide: OllamaService, useValue: mockOllamaService },
        { provide: DEFAULT_REDIS_TOKEN, useValue: mockRedis },
        {
          provide: getRepositoryToken(Attachment),
          useValue: mockAttachmentRepo,
        },
        {
          provide: getRepositoryToken(Project),
          useValue: mockProjectRepo,
        },
        {
          provide: getRepositoryToken(AiAuditLog),
          useValue: mockAiAuditLogRepo,
        },
        { provide: TagsService, useValue: mockTagsService },
        { provide: MigrationService, useValue: mockMigrationService },
        { provide: AiPromptsService, useValue: mockAiPromptsService },
      ],
    }).compile();
    processor = module.get<AiBatchProcessor>(AiBatchProcessor);
    embeddingService = module.get(EmbeddingService);
    ragService = module.get(AiRagService);
    ocrService = module.get(OcrService);
    sandboxOcrEngineService = module.get(SandboxOcrEngineService);
    ollamaService = module.get(OllamaService);
    redis = module.get(DEFAULT_REDIS_TOKEN);
    attachmentRepo = module.get(getRepositoryToken(Attachment));
    jest.clearAllMocks();
  });
  it('OCR_JOB_TYPES ควรมี ocr-extract เป็นสมาชิก (ADR-034)', () => {
    expect(OCR_JOB_TYPES).toContain('ocr-extract');
  });
  it('ocr-extract: ควร unload main → load OCR (keep_alive:0) → generate → reload main (ADR-034)', async () => {
    const job = {
      id: 'job-ocr-extract',
      data: {
        jobType: 'ocr-extract',
        documentPublicId: 'doc-ocr-uuid-001',
        projectPublicId: 'proj-uuid-456',
        payload: { prompt: 'Extract OCR text from this document.' },
        idempotencyKey: 'idem-ocr-001',
      },
    } as unknown as Job<AiBatchJobData>;
    await processor.process(job);
    expect(mockOllamaService.unloadModel).toHaveBeenCalledWith(
      'typhoon2.5-np-dms:latest'
    );
    expect(mockOllamaService.loadModel).toHaveBeenCalledWith(
      'typhoon-np-dms-ocr:latest',
      0
    );
    expect(mockOllamaService.generate).toHaveBeenCalledWith(
      'Extract OCR text from this document.',
      expect.objectContaining({
        model: 'typhoon-np-dms-ocr:latest',
        timeoutMs: 120000,
      })
    );
    expect(mockOllamaService.loadModel).toHaveBeenCalledWith(
      'typhoon2.5-np-dms:latest',
      -1
    );
    expect(mockRedis.setex).toHaveBeenCalledWith(
      'ai:ocr:result:doc-ocr-uuid-001',
      3600,
      expect.stringContaining('typhoon-np-dms-ocr:latest')
    );
    expect(attachmentRepo.update).toHaveBeenCalledWith(
      { publicId: 'doc-ocr-uuid-001' },
      { aiProcessingStatus: 'DONE' }
    );
  });
  it('ควรสามารถเรียก process embed-document และอัปเดตสถานะใน database', async () => {
    const job = {
      id: 'job-embed',
      data: {
        jobType: 'embed-document',
        documentPublicId: 'doc-uuid-123',
        projectPublicId: 'proj-uuid-456',
        payload: { pdfPath: '/files/test.pdf' },
        idempotencyKey: 'idem-123',
      },
    } as unknown as Job<AiBatchJobData>;
    await processor.process(job);
    expect(ocrService.detectAndExtract).toHaveBeenCalledWith({
      pdfPath: '/files/test.pdf',
      extractedText: undefined,
      documentPublicId: 'doc-uuid-123',
    });
    expect(embeddingService.embedDocument).toHaveBeenCalledTimes(1);
    expect(embeddingService.embedDocument).toHaveBeenCalledWith(
      'proj-uuid-456',
      'doc-uuid-123',
      'doc-uuid-123',
      'ATTACHMENT',
      'ACTIVE',
      1,
      'doc-uuid-123',
      undefined,
      'OCR text LCBP3-CIV-001 Civil'
    );
    expect(attachmentRepo.update).toHaveBeenCalledWith(
      { publicId: 'doc-uuid-123' },
      { aiProcessingStatus: 'PROCESSING' }
    );
    expect(attachmentRepo.update).toHaveBeenCalledWith(
      { publicId: 'doc-uuid-123' },
      { aiProcessingStatus: 'DONE' }
    );
  });
  it('ควรประมวลผล sandbox-rag โดยการเรียก ragService.processQuery และข้ามการอัปเดต database', async () => {
    const job = {
      id: 'job-sandbox',
      data: {
        jobType: 'sandbox-rag',
        documentPublicId: 'idem-sandbox-123',
        projectPublicId: 'proj-uuid-456',
        payload: {
          query: 'ทดสอบคำถาม sandbox RAG',
          userPublicId: 'user-uuid-789',
        },
        idempotencyKey: 'idem-sandbox-123',
      },
    } as unknown as Job<AiBatchJobData>;
    await processor.process(job);
    expect(ragService.processQuery).toHaveBeenCalledTimes(1);
    expect(ragService.processQuery).toHaveBeenCalledWith(
      'idem-sandbox-123',
      'ทดสอบคำถาม sandbox RAG',
      'proj-uuid-456',
      'user-uuid-789',
      expect.any(AbortSignal)
    );
    expect(attachmentRepo.update).not.toHaveBeenCalled();
  });
  it('ควรประมวลผล sandbox-extract โดยใช้ OcrService, OllamaService และเก็บค่าลง Redis', async () => {
    const job = {
      id: 'job-extract',
      data: {
        jobType: 'sandbox-extract',
        documentPublicId: 'idem-extract-123',
        projectPublicId: 'proj-uuid-456',
        payload: { pdfPath: '/files/test.pdf' },
        idempotencyKey: 'idem-extract-123',
      },
    } as unknown as Job<AiBatchJobData>;
    await processor.process(job);
    expect(sandboxOcrEngineService.detectAndExtract).toHaveBeenCalledWith(
      '/files/test.pdf',
      'auto'
    );
    expect(ollamaService.generate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        format: 'json',
        timeoutMs: 120000,
      })
    );
    expect(redis.setex).toHaveBeenCalledTimes(2);
    expect(redis.setex).toHaveBeenLastCalledWith(
      'ai:rag:result:idem-extract-123',
      3600,
      expect.stringContaining('completed')
    );
  });
  it('sandbox-ai-extract ควร regenerate response ใหม่เมื่อ parse JSON ครั้งแรกล้มเหลว', async () => {
    const cachedOcrPayload = {
      ocrText: 'OCR text for retry test\u0002\u0000',
      ocrUsed: true,
      engineUsed: 'typhoon-np-dms-ocr',
      fallbackUsed: false,
      timestamp: '2026-06-06T15:00:00.000Z',
    };
    mockRedis.get = jest
      .fn()
      .mockResolvedValueOnce(JSON.stringify(cachedOcrPayload));
    mockAiPromptsService.findByVersion = jest.fn().mockResolvedValue({
      id: 1,
      promptType: 'ocr_extraction',
      versionNumber: 2,
      template:
        'Resolved test prompt with OCR text {{ocr_text}} and context {{master_data_context}}',
      isActive: true,
      contextConfig: { filter: {} },
    });
    mockOllamaService.generate
      .mockResolvedValueOnce('{\u0002\u0000')
      .mockResolvedValueOnce(
        JSON.stringify({
          subject: 'Recovered after retry',
          confidence: 0.91,
          tags: ['retry'],
        })
      );
    const job = {
      id: 'job-ai-extract-retry',
      data: {
        jobType: 'sandbox-ai-extract',
        documentPublicId: 'idem-ai-extract-123',
        projectPublicId: 'default',
        payload: { promptVersion: 2 },
        idempotencyKey: 'idem-ai-extract-123',
      },
    } as unknown as Job<AiBatchJobData>;
    await processor.process(job);
    expect(mockOllamaService.generate).toHaveBeenCalledTimes(2);
    expect(mockOllamaService.generate).toHaveBeenNthCalledWith(
      1,
      expect.not.stringContaining('\u0002'),
      expect.objectContaining({
        format: 'json',
        timeoutMs: 120000,
      })
    );
    expect(mockAiPromptsService.saveTestResult).toHaveBeenCalledWith(
      'ocr_extraction',
      2,
      expect.objectContaining({
        subject: 'Recovered after retry',
        confidence: 0.91,
      })
    );
    expect(mockRedis.setex).toHaveBeenLastCalledWith(
      'ai:rag:result:idem-ai-extract-123',
      3600,
      expect.stringContaining('"llmPrompt"')
    );
  });
  it('EC-001: ควรบันทึก aiIssues เมื่อ AI สกัด Tag ใหม่ที่ไม่มีในระบบ', async () => {
    mockTagsService.findOrSuggestTags.mockResolvedValueOnce([
      {
        tag: { id: 5, publicId: 'tag-uuid-999', tagName: 'foundation' },
        isNew: false,
      },
      {
        tag: { id: 99, publicId: 'tag-uuid-new', tagName: 'newlytag' },
        isNew: true,
      },
    ]);
    const mockManager = {
      createQueryBuilder: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ id: 10 }),
    };
    (mockAttachmentRepo as unknown as { manager: unknown }).manager =
      mockManager;
    mockProjectRepo.findOne.mockResolvedValue({
      id: 2,
      publicId: 'proj-uuid-456',
    });
    const job = {
      id: 'job-ec001',
      data: {
        jobType: 'migrate-document',
        documentPublicId: 'doc-uuid-123',
        projectPublicId: 'proj-uuid-456',
        payload: { documentNumber: 'LEGACY-EC001', title: 'EC001 Title' },
        idempotencyKey: 'idem-ec001',
        batchId: 'batch-ec001',
      },
    } as unknown as Job<AiBatchJobData>;
    await processor.process(job);
    expect(mockMigrationService.enqueueRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        aiIssues: expect.arrayContaining([
          expect.objectContaining({
            type: 'NEW_TAG_SUGGESTED',
            tagName: 'newlytag',
          }),
        ]),
      })
    );
  });
  it('EC-002: ควรตั้ง isValid=false และบันทึก aiIssues เมื่อ UUID ผู้ส่งไม่พบใน Master Data', async () => {
    mockTagsService.findOrSuggestTags.mockResolvedValueOnce([]);
    mockOllamaService.generate.mockResolvedValueOnce(
      JSON.stringify({
        documentNumber: 'LEGACY-EC002',
        subject: 'EC002 Subject',
        discipline: 'Civil',
        category: 'Correspondence',
        originatorOrganizationPublicId: 'unknown-org-uuid',
        confidence: 0.95,
        tags: [],
        summary: 'summary',
      })
    );
    const mockManager = {
      createQueryBuilder: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue(null),
    };
    (mockAttachmentRepo as unknown as { manager: unknown }).manager =
      mockManager;
    mockProjectRepo.findOne.mockResolvedValue({
      id: 2,
      publicId: 'proj-uuid-456',
    });
    const job = {
      id: 'job-ec002',
      data: {
        jobType: 'migrate-document',
        documentPublicId: 'doc-uuid-123',
        projectPublicId: 'proj-uuid-456',
        payload: { documentNumber: 'LEGACY-EC002', title: 'EC002 Title' },
        idempotencyKey: 'idem-ec002',
        batchId: 'batch-ec002',
      },
    } as unknown as Job<AiBatchJobData>;
    await processor.process(job);
    expect(mockMigrationService.enqueueRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        isValid: false,
        aiIssues: expect.arrayContaining([
          expect.objectContaining({
            type: 'UNRESOLVED_SENDER_UUID',
            uuid: 'unknown-org-uuid',
          }),
        ]),
      })
    );
  });
  it('ควรประมวลผล migrate-document โดยจำลอง OCR, AI และเรียก migrationService.enqueueRecord', async () => {
    const mockManager = {
      createQueryBuilder: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ id: 10 }),
    };
    (mockAttachmentRepo as unknown as { manager: unknown }).manager =
      mockManager;
    const job = {
      id: 'job-migrate',
      data: {
        jobType: 'migrate-document',
        documentPublicId: 'doc-uuid-123',
        projectPublicId: 'proj-uuid-456',
        payload: {
          documentNumber: 'LEGACY-001',
          title: 'Legacy Title',
          senderOrgId: 1,
          receiverOrgId: 2,
          contextOverride: {
            contractPublicId: 'contract-uuid-789',
          },
        },
        idempotencyKey: 'idem-migrate-123',
        batchId: 'batch-999',
      },
    } as unknown as Job<AiBatchJobData>;
    await processor.process(job);
    expect(attachmentRepo.findOne).toHaveBeenCalledWith({
      where: { publicId: 'doc-uuid-123' },
    });
    expect(ocrService.detectAndExtract).toHaveBeenCalledWith({
      pdfPath: '/files/test.pdf',
    });
    expect(ollamaService.generate).toHaveBeenCalledTimes(1);
    expect(mockTagsService.findOrSuggestTags).toHaveBeenCalledTimes(1);
    expect(mockMigrationService.enqueueRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        documentNumber: 'LEGACY-001',
        subject: 'Foundation Inspection Report',
        category: 'Correspondence',
        isValid: true,
        confidence: 0.95,
      })
    );
    expect(mockAiPromptsService.resolveContext).toHaveBeenCalledWith(
      expect.anything(),
      'proj-uuid-456',
      'contract-uuid-789'
    );
    expect(mockAiAuditLogRepo.create).toHaveBeenCalledTimes(1);
    expect(mockAiAuditLogRepo.save).toHaveBeenCalledTimes(1);
  });
  describe('rag-prepare', () => {
    it('ควรประมวลผล rag-prepare สำเร็จเมื่อส่ง cachedOcrText มาโดยตรง', async () => {
      const job = {
        id: 'job-rag-prepare-cached',
        data: {
          jobType: 'rag-prepare',
          documentPublicId: 'doc-uuid-123',
          projectPublicId: 'proj-uuid-456',
          payload: {
            documentPublicId: 'doc-uuid-123',
            projectPublicId: 'proj-uuid-456',
            correspondenceNumber: 'CORR-001',
            docType: 'LETTER',
            statusCode: 'IN_REVIEW',
            revisionNumber: 1,
            subject: 'Test Subject',
            cachedOcrText:
              'some cached ocr text that is long enough to pass the 50 character limit check',
          },
        },
      } as unknown as Job<AiBatchJobData>;
      await processor.process(job);
      expect(embeddingService.embedDocument).toHaveBeenCalledWith(
        'proj-uuid-456',
        'doc-uuid-123',
        'CORR-001',
        'LETTER',
        'IN_REVIEW',
        1,
        'Test Subject',
        undefined,
        'some cached ocr text that is long enough to pass the 50 character limit check'
      );
    });
    it('ควรประมวลผล rag-prepare สำเร็จเมื่อดึงข้อความจากไฟล์แนบผ่าน OCR Service', async () => {
      ocrService.detectAndExtract.mockResolvedValueOnce({
        text: 'extracted ocr text from document that is long enough to bypass character length check',
        ocrUsed: true,
      });
      const job = {
        id: 'job-rag-prepare-ocr',
        data: {
          jobType: 'rag-prepare',
          documentPublicId: 'doc-uuid-123',
          projectPublicId: 'proj-uuid-456',
          payload: {
            documentPublicId: 'doc-uuid-123',
            projectPublicId: 'proj-uuid-456',
            correspondenceNumber: 'CORR-002',
            docType: 'LETTER',
            statusCode: 'IN_REVIEW',
            revisionNumber: 2,
            subject: 'Test OCR Subject',
            attachmentPath: '/files/test-ocr.pdf',
          },
        },
      } as unknown as Job<AiBatchJobData>;
      await processor.process(job);
      expect(ocrService.detectAndExtract).toHaveBeenCalledWith({
        pdfPath: '/files/test-ocr.pdf',
      });
      expect(embeddingService.embedDocument).toHaveBeenCalledWith(
        'proj-uuid-456',
        'doc-uuid-123',
        'CORR-002',
        'LETTER',
        'IN_REVIEW',
        2,
        'Test OCR Subject',
        undefined,
        'extracted ocr text from document that is long enough to bypass character length check'
      );
    });
  });
});
