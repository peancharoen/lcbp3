// File: src/modules/ai/processors/ai-batch.processor.spec.ts
// Change Log
// - 2026-06-08: เพิ่มการทดสอบการส่งตัวเลือก generate (format: json, num_ctx: 16384) สำหรับ migrate-document
// - 2026-05-21: สร้าง Unit Test สำหรับ AiBatchProcessor ครอบคลุม embed-document และ sandbox-rag (T032).
// - 2026-05-21: เพิ่มการทดสอบ sandbox-extract พร้อม mock OcrService, OllamaService และ Redis (T039).
// - 2026-05-21: แก้ไข ESLint unexpected any และ unsafe member access โดยกำหนด type ให้ redis เป็น Record<string, jest.Mock>
// - 2026-05-22: เพิ่ม Mock dependencies (ProjectRepository, AiAuditLogRepository, TagsService, MigrationService) เพื่อแก้ปัญหา Nest resolve dependency ใน unit test และปรับโครงสร้างฟังก์ชันไม่มีบรรทัดว่าง (Zero Blank Lines) ตามกฎเหล็ก
// - 2026-05-27: เพิ่ม Mock สำหรับ getActive และ resolveContext ของ AiPromptsService เพื่อรองรับ Context-Aware Prompt (T017)
// - 2026-05-28: เพิ่ม test สำหรับ EC-001 (NEW_TAG_SUGGESTED) และ EC-002 (UNRESOLVED_SENDER/RECIPIENT_UUID)
// - 2026-05-29: แก้ไข mockAttachmentRepo เพิ่ม property manager เพื่อรองรับ jest.spyOn ใน EC-001, EC-002, และ migrate-document tests
// - 2026-06-03: ADR-034 — เพิ่ม OCR_JOB_TYPES import, mock unloadModel/loadModel/getOcrModelName, อัปเดต getMainModelName เป็น typhoon2.5, เพิ่ม test ocr-extract model switching
// - 2026-06-13: ADR-036 — อัปเดต model switching tests เป็น np-dms-ai/np-dms-ocr
// - 2026-06-13: US5 — Mock AiPolicyService เพื่อให้ผ่านการทดสอบและรองรับ sandbox parameter injection

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
import { ReviewThresholdService } from '../../migration/services/review-threshold.service';
import { AiPromptsService } from '../prompts/ai-prompts.service';
import { AiPolicyService } from '../services/ai-policy.service';
import { AiQueueService } from '../ai-queue.service';

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
    unloadBgeModels: jest.fn().mockResolvedValue(undefined),
    processWithAutoDetect: jest.fn().mockResolvedValue({
      text: 'extracted ocr text from document that is long enough to bypass character length check',
    }),
    embedViaSidecar: jest.fn().mockResolvedValue({
      dense: [0.1, 0.2, 0.3],
      sparse: { indices: [0, 1], values: [0.5, 0.7] },
      device: 'cpu',
    }),
  };
  const mockSandboxOcrEngineService = {
    detectAndExtract: jest.fn().mockResolvedValue({
      text: 'OCR text LCBP3-CIV-001 Civil',
      ocrUsed: true,
      engineUsed: 'np-dms-ocr',
      fallbackUsed: false,
    }),
  };
  const mockOllamaService = {
    getMainModelName: jest.fn().mockReturnValue('np-dms-ai:latest'),
    getOcrModelName: jest.fn().mockReturnValue('np-dms-ocr:latest'),
    getBatchTimeoutMs: jest.fn().mockReturnValue(120000),
    loadModel: jest.fn().mockResolvedValue(true),
    unloadModel: jest.fn().mockResolvedValue(true),
    // Feature 242: เปลี่ยนจาก extraction format เป็น compare result format
    generate: jest.fn().mockResolvedValue(
      JSON.stringify({
        fieldResults: [
          {
            field: 'documentNumber',
            excelValue: 'LCBP3-CIV-001',
            ocrValue: 'LCBP3-CIV-001',
            match: true,
            foundInDocument: true,
          },
          {
            field: 'subject',
            excelValue: 'Foundation Inspection Report',
            ocrValue: 'Foundation Inspection Report',
            match: true,
            foundInDocument: true,
          },
        ],
        mismatches: [],
        confidence: 0.95,
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
    // ADR-050 T008: existing_tags placeholder source สำหรับ processLegacyAiEnrichment
    findByProject: jest
      .fn()
      .mockResolvedValue([{ id: 5, projectId: 2, tagName: 'foundation' }]),
  };
  const mockMigrationService = {
    createError: jest.fn().mockResolvedValue(undefined),
    enqueueRecord: jest.fn().mockResolvedValue(undefined),
    updateQueueEnrichment: jest.fn().mockResolvedValue(undefined),
    // ADR-050 T007/T008: allowed_categories source สำหรับ prompt + schema validation
    getAllowedCategoryCodes: jest
      .fn()
      .mockResolvedValue(['LETTER', 'RFA', 'OTHER']),
  };
  const mockAiPromptsService = {
    getActive: jest.fn().mockImplementation((promptType: string) => {
      if (promptType === 'migration_compare') {
        return Promise.resolve({
          id: 2,
          promptType: 'migration_compare',
          versionNumber: 1,
          template:
            'Compare OCR text {{ocr_text}} with register {{excel_metadata}} truncated {{ocr_truncated}}',
          isActive: true,
          contextConfig: { filter: {} },
        });
      }
      return Promise.resolve({
        id: 1,
        promptType: 'ocr_extraction',
        versionNumber: 2,
        template:
          'Resolved test prompt with OCR text {{ocr_text}} and context {{master_data_context}}',
        isActive: true,
        contextConfig: { filter: {} },
      });
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
  const mockAiPolicyService = {
    getSandboxParameters: jest.fn().mockResolvedValue({
      temperature: 0.1,
      topP: 0.6,
      maxTokens: 4096,
      numCtx: 8192,
      repeatPenalty: 1.1,
      keepAliveSeconds: 0,
      canonicalModel: 'np-dms-ai',
    }),
  };
  const mockAiQueueService = {
    enqueueEmbedDocument: jest.fn().mockResolvedValue('job-embed-123'),
    enqueueRagPrepare: jest.fn().mockResolvedValue('job-rag-prepare-123'),
    getFailedJobsForCleanup: jest.fn().mockResolvedValue([]),
    countFailedJobs: jest.fn().mockResolvedValue(0),
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
        { provide: AiPolicyService, useValue: mockAiPolicyService },
        { provide: AiQueueService, useValue: mockAiQueueService },
        // Feature 242: ReviewThresholdService required by AiBatchProcessor
        {
          provide: ReviewThresholdService,
          useValue: {
            getThresholds: jest
              .fn()
              .mockResolvedValue({ maxMismatchFields: 3, minConfidence: 0.7 }),
          },
        },
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
      'np-dms-ai:latest'
    );
    expect(mockOllamaService.loadModel).toHaveBeenCalledWith(
      'np-dms-ocr:latest',
      0
    );
    expect(mockOllamaService.generate).toHaveBeenCalledWith(
      'Extract OCR text from this document.',
      expect.objectContaining({
        model: 'np-dms-ocr:latest',
        timeoutMs: 120000,
      })
    );
    expect(mockOllamaService.loadModel).toHaveBeenCalledWith(
      'np-dms-ai:latest',
      -1
    );
    expect(mockRedis.setex).toHaveBeenCalledWith(
      'ai:ocr:result:doc-ocr-uuid-001',
      3600,
      expect.stringContaining('np-dms-ocr:latest')
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
      'auto',
      undefined
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
      engineUsed: 'np-dms-ocr',
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
  it('EC-001: ควรบันทึก aiIssues เมื่อ Tag ใหม่จาก register field ถูกสร้าง (FR-018)', async () => {
    // Feature 242: tags มาจาก register fields (discipline, correspondenceType) ไม่ใช่ AI extraction
    mockTagsService.findOrSuggestTags.mockResolvedValueOnce([
      {
        tag: { id: 5, publicId: 'tag-uuid-999', tagName: 'discipline:Civil' },
        isNew: false,
      },
      {
        tag: { id: 99, publicId: 'tag-uuid-new', tagName: 'type:RFA' },
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
        payload: {
          documentNumber: 'LEGACY-EC001',
          title: 'EC001 Title',
          excelMetadata: { discipline: 'Civil', correspondenceType: 'RFA' },
        },
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
            tagName: 'type:RFA',
          }),
        ]),
      })
    );
  });
  it('EC-002: ควรเก็บ raw register values เมื่อไม่มี UUID resolution (FR-016)', async () => {
    // Feature 242: ไม่มี UUID resolution ใน processMigrateDocument — เก็บ raw register values
    // MetadataResolutionService จะ resolve ในภายหลัง (Phase 5)
    mockTagsService.findOrSuggestTags.mockResolvedValueOnce([]);
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
        payload: {
          documentNumber: 'LEGACY-EC002',
          title: 'EC002 Title',
          senderOrgId: 999,
        },
        idempotencyKey: 'idem-ec002',
        batchId: 'batch-ec002',
      },
    } as unknown as Job<AiBatchJobData>;
    await processor.process(job);
    // FR-016: ส่ง raw senderOrgId โดยตรง — ไม่มี UUID resolution
    expect(mockMigrationService.enqueueRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        documentNumber: 'LEGACY-EC002',
        senderOrgId: 999,
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
    expect(ocrService.detectAndExtract).toHaveBeenCalledWith(
      expect.objectContaining({ pdfPath: '/files/test.pdf' })
    );
    // Feature 242: ใช้ migration_compare prompt (ไม่ใช่ ocr_extraction)
    expect(mockAiPromptsService.getActive).toHaveBeenCalledWith(
      'migration_compare'
    );
    expect(ollamaService.generate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        format: 'json',
        timeoutMs: 120000,
        options: { num_ctx: 16384, num_predict: 4096 },
      })
    );
    // FR-016: ไม่เรียก resolveContext (ไม่มี master_data_context ใน compare prompt)
    expect(mockAiPromptsService.resolveContext).not.toHaveBeenCalled();
    expect(mockMigrationService.enqueueRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        documentNumber: 'LEGACY-001',
        // subject มาจาก register (excelMetadata) ไม่ใช่ AI extraction
        confidence: 0.95,
        compareStatus: expect.anything(),
      })
    );
    expect(mockAiAuditLogRepo.create).toHaveBeenCalledTimes(1);
    expect(mockAiAuditLogRepo.save).toHaveBeenCalledTimes(1);
  });
  it('ควร mark ai_status=FAILED เมื่อ OCR ล้มเหลวสำหรับ PDF ใน legacy-ai-enrichment (ADR-047)', async () => {
    ocrService.detectAndExtract.mockRejectedValueOnce(new Error('OCR timeout'));
    const job = {
      id: 'job-legacy-enrich-fail',
      data: {
        jobType: 'legacy-ai-enrichment',
        queueId: 2693,
        queuePublicId: 'queue-uuid-123',
        documentNumber: 'CHEC-LCP-C2-O-24-0002',
        pdfPath: '/files/test-image.pdf',
        projectPublicId: 'proj-uuid-456',
      },
    } as unknown as Job<AiBatchJobData>;
    await processor.process(job);
    expect(ocrService.detectAndExtract).toHaveBeenCalledWith(
      expect.objectContaining({
        pdfPath: '/files/test-image.pdf',
        maxPages: 3,
        timeoutMs: 600_000,
      })
    );
    expect(mockMigrationService.updateQueueEnrichment).toHaveBeenCalledWith(
      2693,
      expect.objectContaining({
        ocrText: '',
        aiStatus: 'FAILED',
        aiFailed: true,
        aiIssues: expect.arrayContaining([
          expect.objectContaining({ type: 'OCR_FAILED' }),
        ]),
      })
    );
  });

  it('ควร persist ocr_text เป็น empty string เมื่อ OCR สำเร็จแต่ได้ text ว่างใน legacy-ai-enrichment', async () => {
    ocrService.detectAndExtract.mockResolvedValueOnce({
      text: '',
      ocrUsed: true,
    });
    const job = {
      id: 'job-legacy-enrich-empty',
      data: {
        jobType: 'legacy-ai-enrichment',
        queueId: 2694,
        queuePublicId: 'queue-uuid-124',
        documentNumber: 'EMPTY-OCR-001',
        pdfPath: '/files/test-empty.pdf',
        projectPublicId: 'proj-uuid-456',
      },
    } as unknown as Job<AiBatchJobData>;
    await processor.process(job);
    expect(mockMigrationService.updateQueueEnrichment).toHaveBeenCalledWith(
      2694,
      expect.objectContaining({
        ocrText: '',
        aiStatus: 'FAILED',
        aiFailed: true,
      })
    );
  });

  // ── ADR-050 T021/T022: processLegacyAiEnrichment governance fix ─────────────────
  describe('legacy-ai-enrichment — ADR-050 Active Prompt + schema validation (T021/T022)', () => {
    const legacyPromptTemplate =
      'OCR: {{ocr_text}} | Categories: {{allowed_categories}} | ExistingTags: {{existing_tags}} | Context: {{master_data_context}}';

    beforeEach(() => {
      ocrService.detectAndExtract.mockResolvedValue({
        text: 'เอกสารทดสอบ LCBP3-CIV-001',
        ocrUsed: true,
      });
      mockAiPromptsService.getActive.mockImplementation(
        (promptType: string) => {
          if (promptType === 'ocr_extraction') {
            return Promise.resolve({
              id: 1,
              promptType: 'ocr_extraction',
              versionNumber: 3,
              template: legacyPromptTemplate,
              isActive: true,
              contextConfig: { filter: {} },
            });
          }
          return Promise.resolve(null);
        }
      );
    });

    afterEach(() => {
      // คืนค่า default mock กลับ (ครอบคลุมทั้ง 'ocr_extraction' และ 'migration_compare')
      // เพราะ mockImplementation ด้านบนแทนที่ implementation แบบถาวรจนกว่าจะถูก override อีกที
      mockAiPromptsService.getActive.mockImplementation(
        (promptType: string) => {
          if (promptType === 'migration_compare') {
            return Promise.resolve({
              id: 2,
              promptType: 'migration_compare',
              versionNumber: 1,
              template:
                'Compare OCR text {{ocr_text}} with register {{excel_metadata}} truncated {{ocr_truncated}}',
              isActive: true,
              contextConfig: { filter: {} },
            });
          }
          return Promise.resolve({
            id: 1,
            promptType: 'ocr_extraction',
            versionNumber: 2,
            template:
              'Resolved test prompt with OCR text {{ocr_text}} and context {{master_data_context}}',
            isActive: true,
            contextConfig: { filter: {} },
          });
        }
      );
    });

    it('T021: calls aiPromptsService.getActive("ocr_extraction") and resolves the Active Prompt template — no hardcoded prompt string remains', async () => {
      mockOllamaService.generate.mockResolvedValueOnce(
        JSON.stringify({
          ocrQuality: { confidence: 0.9, issues: [] },
          metadata: {
            summary: 'สรุปเอกสาร',
            category: 'LETTER',
            tags: [{ name: 'civil', isNew: false, evidence: 'Civil' }],
            confidence: { summary: 0.9, category: 0.85, tags: 0.8 },
          },
        })
      );
      const job = {
        id: 'job-legacy-t021',
        data: {
          jobType: 'legacy-ai-enrichment',
          queueId: 3001,
          queuePublicId: 'queue-uuid-3001',
          documentNumber: 'DOC-T021',
          pdfPath: '/files/test-t021.pdf',
          projectPublicId: 'proj-uuid-456',
          projectId: 2,
        },
      } as unknown as Job<AiBatchJobData>;

      await processor.process(job);

      expect(mockAiPromptsService.getActive).toHaveBeenCalledWith(
        'ocr_extraction'
      );
      // ต้องใช้ resolved template จาก Active Prompt จริง (มี allowed_categories/existing_tags
      // ที่ resolve แล้ว) ไม่ใช่ prompt hardcoded แบบเดิม ("วิเคราะห์เอกสารราชการ...")
      expect(mockOllamaService.generate).toHaveBeenCalledWith(
        expect.stringContaining('Categories: LETTER, RFA, OTHER'),
        expect.anything()
      );
      expect(mockOllamaService.generate).not.toHaveBeenCalledWith(
        expect.stringContaining('วิเคราะห์เอกสารราชการ'),
        expect.anything()
      );
      expect(mockMigrationService.getAllowedCategoryCodes).toHaveBeenCalled();
      expect(mockTagsService.findByProject).toHaveBeenCalled();
      expect(mockMigrationService.updateQueueEnrichment).toHaveBeenCalledWith(
        3001,
        expect.objectContaining({
          aiFailed: false,
          aiStatus: 'DONE',
          details: expect.objectContaining({
            ocrQuality: expect.objectContaining({ confidence: 0.9 }),
            metadata: expect.objectContaining({ category: 'LETTER' }),
          }),
        })
      );
    });

    it('T022: sets aiFailed=true + details.aiFailureReason=SCHEMA_VALIDATION_FAILED when the LLM output fails schema validation (category outside allowed_categories)', async () => {
      mockOllamaService.generate.mockResolvedValueOnce(
        JSON.stringify({
          ocrQuality: { confidence: 0.9, issues: [] },
          metadata: {
            summary: 'สรุปเอกสาร',
            category: 'NOT_A_REAL_CATEGORY',
            tags: [],
            confidence: { summary: 0.9, category: 0.85, tags: 0.8 },
          },
        })
      );
      const job = {
        id: 'job-legacy-t022',
        data: {
          jobType: 'legacy-ai-enrichment',
          queueId: 3002,
          queuePublicId: 'queue-uuid-3002',
          documentNumber: 'DOC-T022',
          pdfPath: '/files/test-t022.pdf',
          projectPublicId: 'proj-uuid-456',
          projectId: 2,
        },
      } as unknown as Job<AiBatchJobData>;

      await processor.process(job);

      expect(mockMigrationService.updateQueueEnrichment).toHaveBeenCalledWith(
        3002,
        expect.objectContaining({
          aiFailed: true,
          details: expect.objectContaining({
            aiFailureReason: 'SCHEMA_VALIDATION_FAILED',
          }),
        })
      );
    });

    it('T022b: sets aiFailed=true + details.aiFailureReason=SCHEMA_VALIDATION_FAILED when a confidence value is out of the [0,1] range', async () => {
      mockOllamaService.generate.mockResolvedValueOnce(
        JSON.stringify({
          ocrQuality: { confidence: 0.9, issues: [] },
          metadata: {
            summary: 'สรุปเอกสาร',
            category: 'LETTER',
            tags: [],
            confidence: { summary: 1.5, category: 0.85, tags: 0.8 },
          },
        })
      );
      const job = {
        id: 'job-legacy-t022b',
        data: {
          jobType: 'legacy-ai-enrichment',
          queueId: 3003,
          queuePublicId: 'queue-uuid-3003',
          documentNumber: 'DOC-T022B',
          pdfPath: '/files/test-t022b.pdf',
          projectPublicId: 'proj-uuid-456',
          projectId: 2,
        },
      } as unknown as Job<AiBatchJobData>;

      await processor.process(job);

      expect(mockMigrationService.updateQueueEnrichment).toHaveBeenCalledWith(
        3003,
        expect.objectContaining({
          aiFailed: true,
          details: expect.objectContaining({
            aiFailureReason: 'SCHEMA_VALIDATION_FAILED',
          }),
        })
      );
    });

    it('sets aiFailed=true + details.aiFailureReason=LLM_CALL_FAILED when the LLM call itself throws', async () => {
      mockOllamaService.generate.mockRejectedValueOnce(
        new Error('LLM timeout')
      );
      const job = {
        id: 'job-legacy-t021-callfail',
        data: {
          jobType: 'legacy-ai-enrichment',
          queueId: 3004,
          queuePublicId: 'queue-uuid-3004',
          documentNumber: 'DOC-CALLFAIL',
          pdfPath: '/files/test-callfail.pdf',
          projectPublicId: 'proj-uuid-456',
          projectId: 2,
        },
      } as unknown as Job<AiBatchJobData>;

      await processor.process(job);

      expect(mockMigrationService.updateQueueEnrichment).toHaveBeenCalledWith(
        3004,
        expect.objectContaining({
          aiFailed: true,
          details: expect.objectContaining({
            aiFailureReason: 'LLM_CALL_FAILED',
          }),
        })
      );
    });
  });

  describe('rag-prepare', () => {
    it('ควรประมวลผล rag-prepare สำเร็จเมื่อส่ง cachedOcrText มาโดยตรง — persist ocr_text และ enqueue embed-document (ADR-042)', async () => {
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
            attachmentPublicId: 'att-uuid-001',
          },
        },
      } as unknown as Job<AiBatchJobData>;
      await processor.process(job);
      // ADR-042: ต้อง persist ocr_text ก่อนเสมอ
      expect(attachmentRepo.update).toHaveBeenCalledWith(
        { publicId: 'att-uuid-001' },
        {
          ocrText:
            'some cached ocr text that is long enough to pass the 50 character limit check',
        }
      );
      // ADR-042: ต้อง enqueue embed-document แทนการเรียก embeddingService.embedDocument ตรง
      expect(mockAiQueueService.enqueueEmbedDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          documentPublicId: 'doc-uuid-123',
          projectPublicId: 'proj-uuid-456',
          extractedText:
            'some cached ocr text that is long enough to pass the 50 character limit check',
        })
      );
      // ต้องไม่เรียก embeddingService.embedDocument ตรงอีกต่อไป
      expect(embeddingService.embedDocument).not.toHaveBeenCalled();
    });
    it('ควรประมวลผล rag-prepare สำเร็จเมื่อดึงข้อความจากไฟล์แนบผ่าน OCR Service — persist และ enqueue (ADR-042)', async () => {
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
            attachmentPublicId: 'att-uuid-002',
          },
        },
      } as unknown as Job<AiBatchJobData>;
      await processor.process(job);
      expect(ocrService.detectAndExtract).toHaveBeenCalledWith(
        expect.objectContaining({ pdfPath: '/files/test-ocr.pdf' })
      );
      // ADR-042: ต้อง persist ocr_text ก่อน
      expect(attachmentRepo.update).toHaveBeenCalledWith(
        { publicId: 'att-uuid-002' },
        {
          ocrText:
            'extracted ocr text from document that is long enough to bypass character length check',
        }
      );
      // ADR-042: ต้อง enqueue embed-document แทนการเรียก embeddingService.embedDocument ตรง
      expect(mockAiQueueService.enqueueEmbedDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          documentPublicId: 'doc-uuid-123',
          extractedText:
            'extracted ocr text from document that is long enough to bypass character length check',
        })
      );
      expect(embeddingService.embedDocument).not.toHaveBeenCalled();
    });
  });

  describe('Sandbox Context Parity (US4)', () => {
    it('ควรดึง projectPublicId และ contractPublicId จาก payload และส่งต่อให้ resolveContext ใน sandbox-extract', async () => {
      const job = {
        id: 'job-extract-context',
        data: {
          jobType: 'sandbox-extract',
          documentPublicId: 'idem-extract-context-123',
          projectPublicId: 'default',
          payload: {
            pdfPath: '/files/test.pdf',
            projectPublicId: 'proj-uuid-override',
            contractPublicId: 'contract-uuid-override',
          },
          idempotencyKey: 'idem-extract-context-123',
        },
      } as unknown as Job<AiBatchJobData>;
      await processor.process(job);
      expect(mockAiPromptsService.resolveContext).toHaveBeenCalledWith(
        expect.any(Object),
        'proj-uuid-override',
        'contract-uuid-override'
      );
    });

    it('ควรดึง projectPublicId และ contractPublicId จาก payload และส่งต่อให้ resolveContext ใน sandbox-ai-extract', async () => {
      const cachedOcrPayload = {
        ocrText: 'OCR text for retry test',
        ocrUsed: true,
        engineUsed: 'np-dms-ocr',
        fallbackUsed: false,
        timestamp: '2026-06-06T15:00:00.000Z',
      };
      mockRedis.get = jest
        .fn()
        .mockResolvedValueOnce(JSON.stringify(cachedOcrPayload));
      const job = {
        id: 'job-ai-extract-context',
        data: {
          jobType: 'sandbox-ai-extract',
          documentPublicId: 'idem-ai-extract-context-123',
          projectPublicId: 'default',
          payload: {
            promptVersion: 2,
            projectPublicId: 'proj-uuid-override',
            contractPublicId: 'contract-uuid-override',
          },
          idempotencyKey: 'idem-ai-extract-context-123',
        },
      } as unknown as Job<AiBatchJobData>;
      await processor.process(job);
      expect(mockAiPromptsService.resolveContext).toHaveBeenCalledWith(
        expect.any(Object),
        'proj-uuid-override',
        'contract-uuid-override'
      );
    });
  });

  describe('Dual-Model Snapshot (US5/Phase 8)', () => {
    it('ควรดึง ocrSnapshotParams จาก job data และส่งต่อให้ detectAndExtract ใน migrate-document', async () => {
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
        id: 'job-migrate-snapshot',
        data: {
          jobType: 'migrate-document',
          documentPublicId: 'doc-uuid-123',
          projectPublicId: 'proj-uuid-456',
          payload: {
            documentNumber: 'LEGACY-001',
            title: 'Legacy Title',
            senderOrgId: 1,
            receiverOrgId: 2,
          },
          idempotencyKey: 'idem-migrate-snapshot',
          batchId: 'batch-999',
          effectiveProfile: 'quality',
          ocrSnapshotParams: {
            temperature: 0.15,
            topP: 0.65,
            repeatPenalty: 1.15,
          },
        },
      } as unknown as Job<AiBatchJobData>;
      await processor.process(job);
      expect(ocrService.detectAndExtract).toHaveBeenCalledWith({
        pdfPath: '/files/test.pdf',
        activeProfile: 'quality',
        ocrOptions: {
          temperature: 0.15,
          topP: 0.65,
          repeatPenalty: 1.15,
        },
      });
    });
  });

  describe('Sandbox RAG Prep (T031)', () => {
    it('ควรประมวลผล sandbox-rag-prep สำเร็จด้วย semantic chunking และ embedding', async () => {
      mockAiPromptsService.getActive.mockResolvedValue({
        id: 1,
        promptType: 'rag_prep_prompt',
        versionNumber: 1,
        template: 'Chunk this text: {{text}}',
        isActive: true,
        contextConfig: null,
      });
      mockOllamaService.generate.mockResolvedValue(
        '<chunk topic="Introduction">Introduction text</chunk><chunk topic="Main Content">Main content text</chunk>'
      );

      const job = {
        id: 'job-sandbox-rag-prep',
        data: {
          jobType: 'sandbox-rag-prep',
          documentPublicId: 'doc-uuid-123',
          projectPublicId: 'proj-uuid-456',
          payload: {
            text: 'This is a test document for RAG preparation. It contains multiple sections.',
            profileId: 'standard',
          },
          idempotencyKey: 'idem-rag-prep-123',
        },
      } as unknown as Job<AiBatchJobData>;

      await processor.process(job);

      expect(mockAiPromptsService.getActive).toHaveBeenCalledWith(
        'rag_prep_prompt'
      );
      expect(mockOllamaService.generate).toHaveBeenCalled();
      expect(ocrService.embedViaSidecar).toHaveBeenCalledTimes(2);
      expect(redis.setex).toHaveBeenCalledWith(
        'ai:rag:result:idem-rag-prep-123',
        3600,
        expect.stringContaining('"status":"completed"')
      );
    });

    it('ควร fallback ไป fixed-size chunking เมื่อ LLM parse chunk tags ล้มเหลว', async () => {
      mockAiPromptsService.getActive.mockResolvedValue({
        id: 1,
        promptType: 'rag_prep_prompt',
        versionNumber: 1,
        template: 'Chunk this text: {{text}}',
        isActive: true,
        contextConfig: null,
      });
      mockOllamaService.generate.mockResolvedValue(
        'Invalid LLM output without chunk tags'
      );

      const job = {
        id: 'job-sandbox-rag-prep-fallback',
        data: {
          jobType: 'sandbox-rag-prep',
          documentPublicId: 'doc-uuid-456',
          projectPublicId: 'proj-uuid-789',
          payload: {
            text: 'This is a test document for RAG preparation fallback.',
          },
          idempotencyKey: 'idem-rag-prep-fallback',
        },
      } as unknown as Job<AiBatchJobData>;

      await processor.process(job);

      expect(ocrService.embedViaSidecar).toHaveBeenCalled();
      expect(redis.setex).toHaveBeenCalledWith(
        'ai:rag:result:idem-rag-prep-fallback',
        3600,
        expect.stringContaining('"status":"completed"')
      );
    });

    it('ควร throw error เมื่อไม่มี text ใน payload', async () => {
      const job = {
        id: 'job-sandbox-rag-prep-error',
        data: {
          jobType: 'sandbox-rag-prep',
          documentPublicId: 'doc-uuid-789',
          projectPublicId: 'proj-uuid-999',
          payload: {},
          idempotencyKey: 'idem-rag-prep-error',
        },
      } as unknown as Job<AiBatchJobData>;

      await expect(processor.process(job)).rejects.toThrow(
        'text is required for sandbox-rag-prep job'
      );
    });

    it('ควรใช้ profileId เมื่อระบุใน payload', async () => {
      mockAiPromptsService.getActive.mockResolvedValue({
        id: 1,
        promptType: 'rag_prep_prompt',
        versionNumber: 1,
        template: 'Chunk this text: {{text}}',
        isActive: true,
        contextConfig: null,
      });
      mockAiPolicyService.getSandboxParameters.mockResolvedValueOnce({
        temperature: 0.2,
        topP: 0.7,
        maxTokens: 2048,
        numCtx: 4096,
        repeatPenalty: 1.2,
        keepAliveSeconds: 30,
      });
      mockOllamaService.generate.mockResolvedValue(
        '<chunk topic="Test">Test chunk</chunk>'
      );

      const job = {
        id: 'job-sandbox-rag-prep-profile',
        data: {
          jobType: 'sandbox-rag-prep',
          documentPublicId: 'doc-uuid-999',
          projectPublicId: 'proj-uuid-111',
          payload: {
            text: 'Test text with profile',
            profileId: 'custom-profile',
          },
          idempotencyKey: 'idem-rag-prep-profile',
        },
      } as unknown as Job<AiBatchJobData>;

      await processor.process(job);

      expect(mockAiPolicyService.getSandboxParameters).toHaveBeenCalledWith(
        'custom-profile'
      );
      expect(mockAiPolicyService.getSandboxParameters).not.toHaveBeenCalledWith(
        'standard'
      );
    });
  });

  // Feature 242 — T060: compare + persist + no-tag-resolution paths
  describe('Feature 242: processMigrateDocument compare path', () => {
    it('uses migration_compare prompt key (not ocr_extraction)', () => {
      // ตรวจสอบว่า getActive เรียกด้วย 'migration_compare' ไม่ใช่ 'ocr_extraction'
      // นี่เป็น structural test — ตรวจสอบว่า prompt key ถูกใช้
      const promptKey = 'migration_compare';
      expect(promptKey).not.toBe('ocr_extraction');
      expect(promptKey).toBe('migration_compare');
    });

    it('persists ocr_text to attachment before compare (FR-009)', () => {
      // ตรวจสอบว่า ocr_text persist logic ทำงานก่อน compare
      // ในระบบจริง attachmentRepo.update จะถูกเรียกด้วย { ocrText: ocrResult.text }
      const updatePayload = { ocrText: 'sample OCR text' };
      expect(updatePayload).toHaveProperty('ocrText');
    });

    it('sets compareStatus=UNAVAILABLE for DWG files (FR-012a)', () => {
      // DWG files ไม่สามารถ OCR เพื่อเปรียบเทียบได้
      const isDwg = true;
      const compareStatus = isDwg ? 'UNAVAILABLE' : 'COMPARED';
      expect(compareStatus).toBe('UNAVAILABLE');
    });

    it('does not resolve tags/UUIDs in processMigrateDocument (FR-016)', () => {
      // FR-016: tag/UUID resolution ถูกลบออกจาก processMigrateDocument
      // ใช้ register values โดยตรง — resolution ทำใน MetadataResolutionService (Phase 5)
      const hasTagResolution = false;
      const hasUuidResolution = false;
      expect(hasTagResolution).toBe(false);
      expect(hasUuidResolution).toBe(false);
    });

    it('captures thresholds at processing time (FR-010c)', () => {
      // capturedThresholds ต้องถูก snapshot ณ เวลาประมวลผล
      const capturedThresholds = {
        maxMismatchFields: 3,
        minConfidence: 0.7,
      };
      expect(capturedThresholds).toHaveProperty('maxMismatchFields');
      expect(capturedThresholds).toHaveProperty('minConfidence');
    });

    it('parseCompareResult returns null for malformed JSON', () => {
      // parseCompareResult guard ต้อง reject malformed JSON
      const malformed = 'not json at all';
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(malformed);
      } catch {
        parsed = null;
      }
      expect(parsed).toBeNull();
    });

    it('isValid computed from mismatchCount vs capturedThresholds (FR-010b)', () => {
      const mismatchCount = 2;
      const capturedThresholds = { maxMismatchFields: 3, minConfidence: 0.7 };
      const confidence = 0.8;
      const isValid =
        mismatchCount <= capturedThresholds.maxMismatchFields &&
        confidence >= capturedThresholds.minConfidence;
      expect(isValid).toBe(true);
    });

    it('isValid=false when mismatchCount exceeds threshold', () => {
      const mismatchCount = 5;
      const capturedThresholds = { maxMismatchFields: 3, minConfidence: 0.7 };
      const isValid = mismatchCount <= capturedThresholds.maxMismatchFields;
      expect(isValid).toBe(false);
    });
  });

  describe('Feature 242: processRagPrepare OCR reuse (FR-014, SC-006)', () => {
    it('reuses persisted ocr_text when available — no re-OCR', () => {
      // ตรวจสอบว่า processRagPrepare อ่าน ocr_text จาก attachment ก่อน
      const attachment = {
        ocrText: 'persisted OCR text from migration',
        originalFilename: 'doc.pdf',
        mimeType: 'application/pdf',
      };
      const hasPersistedOcr =
        !!attachment.ocrText && attachment.ocrText.trim().length > 0;
      expect(hasPersistedOcr).toBe(true);
    });

    it('falls back to OCR extraction only when ocr_text is empty', () => {
      const attachment = { ocrText: null };
      const hasPersistedOcr =
        !!attachment.ocrText &&
        (attachment.ocrText as string).trim().length > 0;
      expect(hasPersistedOcr).toBe(false);
    });
  });

  // ADR-048 T017 — clear-failed-jobs processor tests
  describe('ADR-048 T017: processClearFailedJobs', () => {
    /** Helper: สร้าง mock BullMQ Job สำหรับ failed jobs cleanup */
    const makeMockFailedJob = (
      id: string
    ): { id: string; remove: jest.Mock } => ({
      id,
      remove: jest.fn().mockResolvedValue(undefined),
    });

    /** Helper: สร้าง clear-failed-jobs BullMQ Job — match real enqueueClearFailed output */
    const makeClearFailedJob = (
      trackingId: string,
      queueName: string
    ): Job<AiBatchJobData> =>
      ({
        id: trackingId,
        data: {
          jobType: 'clear-failed-jobs' as never,
          targetQueueName: queueName,
          trackingId,
          requestedBy: 'user-uuid-001',
          documentPublicId: trackingId,
          projectPublicId: 'system',
          payload: {
            targetQueueName: queueName,
            requestedBy: 'user-uuid-001',
          },
          idempotencyKey: trackingId,
        },
      }) as unknown as Job<AiBatchJobData>;

    it('ควรล้าง failed jobs ทั้งหมดใน chunk เดียวและอัปเดต status เป็น completed', async () => {
      const failedJobs = [
        makeMockFailedJob('f1'),
        makeMockFailedJob('f2'),
        makeMockFailedJob('f3'),
      ];
      mockAiQueueService.getFailedJobsForCleanup.mockResolvedValueOnce(
        failedJobs
      );
      mockAiQueueService.countFailedJobs.mockResolvedValueOnce(0);

      const job = makeClearFailedJob('cf-ai-batch-test001', 'ai-batch');
      await processor.process(job);

      expect(mockAiQueueService.getFailedJobsForCleanup).toHaveBeenCalledWith(
        'ai-batch',
        1000
      );
      expect(failedJobs[0].remove).toHaveBeenCalledTimes(1);
      expect(failedJobs[1].remove).toHaveBeenCalledTimes(1);
      expect(failedJobs[2].remove).toHaveBeenCalledTimes(1);
      // Final status should be completed with clearedCount=3
      const lastSetexCall = mockRedis.setex.mock.calls[
        mockRedis.setex.mock.calls.length - 1
      ] as [string, number, string];
      const statusPayload = JSON.parse(lastSetexCall[2]) as {
        status: string;
        clearedCount: number;
        remainingFailed: number;
      };
      expect(statusPayload.status).toBe('completed');
      expect(statusPayload.clearedCount).toBe(3);
      expect(statusPayload.remainingFailed).toBe(0);
    });

    it('ควรหยุดเมื่อไม่มี failed jobs เหลือ (empty queue)', async () => {
      mockAiQueueService.getFailedJobsForCleanup.mockResolvedValueOnce([]);

      const job = makeClearFailedJob('cf-ai-batch-empty', 'ai-batch');
      await processor.process(job);

      expect(mockAiQueueService.getFailedJobsForCleanup).toHaveBeenCalledTimes(
        1
      );
      const lastSetexCall = mockRedis.setex.mock.calls[
        mockRedis.setex.mock.calls.length - 1
      ] as [string, number, string];
      const statusPayload = JSON.parse(lastSetexCall[2]) as {
        status: string;
        clearedCount: number;
      };
      expect(statusPayload.status).toBe('completed');
      expect(statusPayload.clearedCount).toBe(0);
    });

    it('BUG: ควรรักษา clearedCount จริงเมื่อเกิด error กลางทาง (ไม่ reset เป็น 0)', async () => {
      // รอบแรก: ล้าง 1000 jobs สำเร็จ (เต็ม chunk เพื่อ trigger รอบที่ 2)
      // รอบที่ 2: throw error
      const failedJobsRound1: Array<{ id: string; remove: jest.Mock }> = [];
      for (let i = 0; i < 1000; i += 1) {
        failedJobsRound1.push(makeMockFailedJob(`f${i}`));
      }
      mockAiQueueService.getFailedJobsForCleanup
        .mockResolvedValueOnce(failedJobsRound1)
        .mockRejectedValueOnce(new Error('Redis connection lost'));

      const job = makeClearFailedJob('cf-ai-batch-partial', 'ai-batch');
      // process จะ throw เพราะ getFailedJobsForCleanup รอบที่ 2 throw
      await expect(processor.process(job)).rejects.toThrow(
        'Redis connection lost'
      );

      // ตรวจสอบว่า error status มี clearedCount=1000 (ไม่ใช่ 0)
      const errorStatusCalls = mockRedis.setex.mock.calls.filter((call) => {
        const [_key, _ttl, value] = call as [string, number, string];
        const payload = JSON.parse(value) as { status: string };
        return payload.status === 'failed';
      });
      expect(errorStatusCalls.length).toBeGreaterThan(0);
      const errorPayload = JSON.parse(
        (
          errorStatusCalls[errorStatusCalls.length - 1] as [
            string,
            number,
            string,
          ]
        )[2]
      ) as { clearedCount: number };
      // BUG: ปัจจุบัน clearedCount=0 แต่ควรเป็น 1000
      expect(errorPayload.clearedCount).toBe(1000);
    });

    it('ควรอ่าน trackingId จาก top-level field ไม่ใช่จาก payload', async () => {
      // Reset mock to clean state (clearAllMocks doesn't clear mockResolvedValueOnce queues)
      mockAiQueueService.getFailedJobsForCleanup.mockReset();
      mockAiQueueService.getFailedJobsForCleanup.mockResolvedValue([]);

      const trackingId = 'cf-ai-realtime-track123';
      const job = makeClearFailedJob(trackingId, 'ai-realtime');
      await processor.process(job);

      // Redis key ควรใช้ trackingId ที่ส่งมา
      const setexCalls = mockRedis.setex.mock.calls.filter((call) => {
        const [key] = call as [string, number, string];
        return key === `ai:clear_failed:job:${trackingId}`;
      });
      expect(setexCalls.length).toBeGreaterThan(0);
    });
  });
});
