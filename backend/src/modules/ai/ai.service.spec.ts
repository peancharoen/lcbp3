// File: src/modules/ai/ai.service.spec.ts
// Unit Tests สำหรับ AiService — ทดสอบ Business Logic สำคัญ: Callback, Update, Status Transitions
// Change Log
// - 2026-05-21: เพิ่ม unit tests สำหรับ getSystemHealth (T026) ทั้งกรณี cache hit/miss และ queue metrics.
// - 2026-06-11: เพิ่ม mock สำหรับ AiPolicyService เพื่อแก้ไข test regression

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { AiValidationService } from './ai-validation.service';
import { AiAuditLog } from './entities/ai-audit-log.entity';
import {
  BusinessException,
  ValidationException,
} from '../../common/exceptions';
import { AuditLog } from '../../common/entities/audit-log.entity';
import {
  QUEUE_AI_BATCH,
  QUEUE_AI_REALTIME,
} from '../common/constants/queue.constants';
import { OllamaService } from './services/ollama.service';
import { AiQdrantService } from './qdrant.service';
import { ImportTransaction } from '../migration/entities/import-transaction.entity';
import { AiSettingsService } from './ai-settings.service';
import { VramMonitorService } from './services/vram-monitor.service';
import { AiPolicyService } from './services/ai-policy.service';
import { Attachment } from '../../common/file-storage/entities/attachment.entity';
import { Project } from '../project/entities/project.entity';

const DEFAULT_REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

describe('AiService', () => {
  let service: AiService;

  // Mock Repositories
  const mockAuditLogRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockMainAuditLogRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn(),
    getJob: jest.fn(),
    isPaused: jest.fn().mockResolvedValue(false),
    getActiveCount: jest.fn().mockResolvedValue(1),
    getWaitingCount: jest.fn().mockResolvedValue(2),
    getFailedCount: jest.fn().mockResolvedValue(3),
    getCompletedCount: jest.fn().mockResolvedValue(4),
    resume: jest.fn(),
    getState: jest.fn().mockResolvedValue('completed'),
  };

  const mockOllamaService = {
    getMainModelName: jest.fn().mockReturnValue('np-dms-ai:latest'),
    getOcrModelName: jest.fn().mockReturnValue('np-dms-ocr:latest'),
    checkHealth: jest.fn().mockResolvedValue({
      status: 'HEALTHY',
      latencyMs: 120,
      models: ['np-dms-ai:latest', 'nomic-embed-text'],
    }),
    loadModel: jest.fn().mockResolvedValue(true),
  };

  const mockQdrantService = {
    checkHealth: jest.fn().mockResolvedValue({
      status: 'HEALTHY',
      latencyMs: 45,
      collections: ['lcbp3_vectors'],
    }),
  };

  const mockAiSettingsService = {
    getAvailableModels: jest
      .fn()
      .mockResolvedValue([
        { id: 1, modelName: 'gemma4:e4b', isActive: true, vramGb: 4.0 },
      ]),
    getActiveModel: jest.fn().mockResolvedValue('gemma4:e4b'),
    setActiveModel: jest.fn().mockResolvedValue('gemma4:e4b'),
  };

  const mockVramMonitorService = {
    hasVramCapacity: jest.fn().mockResolvedValue(true),
    getVramStatus: jest.fn().mockResolvedValue({
      totalVramMb: 8192,
      usedVramMb: 2048,
      freeVramMb: 6144,
      loadedModels: [],
      hasCapacity: true,
    }),
  };

  // Mock AiPolicyService
  const mockAiPolicyService = {
    getCanonicalModelName: jest.fn().mockImplementation((name: string) => {
      if (name.includes('ocr')) return 'np-dms-ocr';
      return 'np-dms-ai';
    }),
    getProfileForJobType: jest.fn().mockReturnValue('standard'),
    getProfileParameters: jest.fn().mockResolvedValue({
      canonicalModel: 'np-dms-ai',
      temperature: 0.5,
      topP: 0.8,
      maxTokens: 4096,
      numCtx: 8192,
      repeatPenalty: 1.15,
      keepAliveSeconds: 600,
    }),
    createJobPayload: jest
      .fn()
      .mockImplementation(async (jobType, docId, attachId) => {
        await Promise.resolve();
        return {
          jobType,
          documentPublicId: docId,
          attachmentPublicId: attachId,
          effectiveProfile: 'standard',
          canonicalModel: 'np-dms-ai',
          snapshotParams: {
            temperature: 0.5,
            topP: 0.8,
            maxTokens: 4096,
            numCtx: 8192,
            repeatPenalty: 1.15,
            keepAliveSeconds: 600,
          },
        };
      }),
  };

  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const mockImportTransactionRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    manager: {
      findOne: jest.fn(),
    },
  };

  // Mock ConfigService — คืนค่า Config ตาม Key
  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string | number> = {
        AI_TIMEOUT_MS: 30000,
      };
      return config[key];
    }),
  };

  // Mock AiValidationService

  const mockValidationService = {
    validateAiOutput: jest.fn(),
    buildAuditSummary: jest
      .fn()
      .mockReturnValue('model=gemma4, confidence=0.90, valid=true'),
    getConfidenceAction: jest.fn().mockReturnValue('low_priority_review'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAuditLogRepo.create.mockReturnValue({});
    mockAuditLogRepo.save.mockResolvedValue({});
    mockMainAuditLogRepo.create.mockReturnValue({});
    mockMainAuditLogRepo.save.mockResolvedValue({});
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: getRepositoryToken(AiAuditLog), useValue: mockAuditLogRepo },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockMainAuditLogRepo,
        },
        {
          provide: getRepositoryToken(ImportTransaction),
          useValue: mockImportTransactionRepo,
        },
        { provide: getQueueToken(QUEUE_AI_REALTIME), useValue: mockQueue },
        { provide: getQueueToken(QUEUE_AI_BATCH), useValue: mockQueue },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AiValidationService, useValue: mockValidationService },
        { provide: OllamaService, useValue: mockOllamaService },
        { provide: AiQdrantService, useValue: mockQdrantService },
        { provide: AiSettingsService, useValue: mockAiSettingsService },
        { provide: VramMonitorService, useValue: mockVramMonitorService },
        { provide: AiPolicyService, useValue: mockAiPolicyService },
        { provide: DEFAULT_REDIS_TOKEN, useValue: mockRedis },
      ],
    }).compile();
    service = module.get<AiService>(AiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('submitMigrationJob', () => {
    it('ควรส่ง projectPublicId และ contextOverride จาก n8n เข้า BullMQ โดยไม่ใช้ default project', async () => {
      mockImportTransactionRepo.findOne.mockResolvedValue(null);
      mockQueue.getJob.mockResolvedValue(null);
      mockQueue.add.mockResolvedValue({ id: 'job-001' });
      const result = await service.submitMigrationJob(
        {
          type: 'migrate-document',
          payload: {
            tempAttachmentId: '019505a1-7c3e-7000-8000-abc123def456',
            documentNumber: 'LEGACY-001',
            title: 'Legacy Title',
            batchId: 'C22024-MIGRATION',
            contextOverride: {
              projectPublicId: '019505a1-7c3e-7000-8000-abc123def777',
              contractPublicId: '019505a1-7c3e-7000-8000-abc123def888',
            },
          },
        },
        'C22024-MIGRATION:LEGACY-001'
      );
      expect(result).toEqual({ success: true, jobId: 'job-001' });
      expect(mockImportTransactionRepo.manager.findOne).not.toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalledWith(
        'migrate-document',
        expect.objectContaining({
          projectPublicId: '019505a1-7c3e-7000-8000-abc123def777',
          batchId: 'C22024-MIGRATION',
          payload: expect.objectContaining({
            contextOverride: {
              projectPublicId: '019505a1-7c3e-7000-8000-abc123def777',
              contractPublicId: '019505a1-7c3e-7000-8000-abc123def888',
            },
          }),
        }),
        { jobId: 'C22024-MIGRATION:LEGACY-001' }
      );
    });
  });

  describe('submitUnifiedJob', () => {
    it('ไม่ควรบันทึก ai_audit_logs เป็น SUCCESS ตั้งแต่ตอน enqueue', async () => {
      mockImportTransactionRepo.manager.findOne.mockResolvedValueOnce({
        publicId: '019505a1-7c3e-7000-8000-abc123def777',
      });
      mockQueue.getJob.mockResolvedValue(null);
      mockQueue.add.mockResolvedValue({ id: 'job-enqueued' });
      const result = await service.submitUnifiedJob(
        {
          type: 'rag-query',
          projectPublicId: '019505a1-7c3e-7000-8000-abc123def777',
          payload: { query: 'test' },
        },
        'job-enqueued'
      );
      expect(result).toEqual({
        jobId: 'job-enqueued',
        status: 'queued',
        modelUsed: 'np-dms-ai',
        effectiveProfile: 'standard',
        queueName: 'ai-batch',
      });
      expect(mockAuditLogRepo.save).not.toHaveBeenCalled();
    });

    it('ควร reject rag-query ที่ไม่มี payload.query', async () => {
      await expect(
        service.submitUnifiedJob(
          {
            type: 'rag-query',
            projectPublicId: '019505a1-7c3e-7000-8000-abc123def777',
            payload: {},
          },
          'job-no-query'
        )
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('ควร reject projectPublicId ที่ไม่พบในระบบด้วย 422', async () => {
      mockImportTransactionRepo.manager.findOne.mockResolvedValueOnce(null);
      await expect(
        service.submitUnifiedJob(
          {
            type: 'rag-query',
            projectPublicId: '019505a1-7c3e-7000-8000-abc123def777',
            payload: { query: 'test' },
          },
          'job-missing-project'
        )
      ).rejects.toBeInstanceOf(BusinessException);
      expect(mockImportTransactionRepo.manager.findOne).toHaveBeenCalledWith(
        Project,
        {
          where: { publicId: '019505a1-7c3e-7000-8000-abc123def777' },
        }
      );
    });

    it('ควร reject attachment reference ที่ไม่พบในระบบด้วย 422', async () => {
      mockImportTransactionRepo.manager.findOne
        .mockResolvedValueOnce({
          publicId: '019505a1-7c3e-7000-8000-abc123def777',
        })
        .mockResolvedValueOnce(null);
      await expect(
        service.submitUnifiedJob(
          {
            type: 'rag-query',
            projectPublicId: '019505a1-7c3e-7000-8000-abc123def777',
            documentPublicId: '019505a1-7c3e-7000-8000-abc123def456',
            payload: { query: 'test' },
          },
          'job-missing-attachment'
        )
      ).rejects.toBeInstanceOf(BusinessException);
      expect(mockImportTransactionRepo.manager.findOne).toHaveBeenCalledWith(
        Attachment,
        {
          where: { publicId: '019505a1-7c3e-7000-8000-abc123def456' },
        }
      );
    });
  });

  // --- getSystemHealth ---

  describe('getSystemHealth', () => {
    it('ควรอ่านข้อมูลสุขภาพจาก Redis cache หากมีข้อมูลอยู่แล้ว (Cache Hit)', async () => {
      const mockCachedData = {
        ollama: { status: 'HEALTHY', latencyMs: 50, models: ['model1'] },
        qdrant: { status: 'HEALTHY', latencyMs: 20, collections: ['col1'] },
        queues: {
          realtime: {
            active: 1,
            waiting: 2,
            failed: 3,
            completed: 4,
            isPaused: false,
          },
          batch: {
            active: 1,
            waiting: 2,
            failed: 3,
            completed: 4,
            isPaused: false,
          },
        },
        timestamp: '2026-05-21T12:00:00.000Z',
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(mockCachedData));
      const result = await service.getSystemHealth();
      expect(result).toEqual(mockCachedData);
      expect(mockRedis.get).toHaveBeenCalledWith('system_health:cache');
      expect(mockOllamaService.checkHealth).not.toHaveBeenCalled();
    });

    it('ควรดึงข้อมูลจาก Service และบันทึกลง Redis cache เมื่อไม่มีข้อมูลใน cache (Cache Miss)', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockOllamaService.checkHealth.mockResolvedValue({
        status: 'HEALTHY',
        latencyMs: 120,
        models: ['gemma4:e4b', 'nomic-embed-text'],
      });
      mockQdrantService.checkHealth.mockResolvedValue({
        status: 'HEALTHY',
        latencyMs: 45,
        collections: ['lcbp3_vectors'],
      });
      const result = await service.getSystemHealth();
      expect(result.ollama.status).toBe('HEALTHY');
      expect(result.qdrant.status).toBe('HEALTHY');
      expect(result.queues.realtime).toEqual({
        active: 1,
        waiting: 2,
        failed: 3,
        completed: 4,
        isPaused: false,
      });
      expect(mockRedis.set).toHaveBeenCalledWith(
        'system_health:cache',
        expect.any(String),
        'EX',
        30
      );
    });
  });

  describe('activateAiModel', () => {
    it('ควรขว้าง BusinessException เมื่อโหลดโมเดลล่วงหน้า (Pre-loading) ล้มเหลว', async () => {
      mockOllamaService.loadModel.mockResolvedValueOnce(false);
      await expect(
        service.activateAiModel(
          { modelId: '019505a1-7c3e-7000-8000-abc123def202' },
          1
        )
      ).rejects.toBeInstanceOf(BusinessException);
      expect(mockOllamaService.loadModel).toHaveBeenCalledWith('gemma4:e4b');
      expect(mockAiSettingsService.setActiveModel).not.toHaveBeenCalled();
    });

    it('ควรสลับโมเดลสำเร็จเมื่อ Ollama โหลดโมเดลเรียบร้อย', async () => {
      mockOllamaService.loadModel.mockResolvedValueOnce(true);
      const result = await service.activateAiModel(
        { modelId: '019505a1-7c3e-7000-8000-abc123def202' },
        1
      );
      expect(result).toBe('gemma4:e4b');
      expect(mockOllamaService.loadModel).toHaveBeenCalledWith('gemma4:e4b');
      expect(mockAiSettingsService.setActiveModel).toHaveBeenCalledWith(
        'gemma4:e4b',
        1
      );
    });
  });
});
