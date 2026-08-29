// File: backend/src/modules/ai/ai.controller.spec.ts
// Change Log:
// - 2026-09-15: สร้าง unit test สำหรับ AiController ครอบคลุม endpoints หลักทั้งหมด

import { Test, TestingModule } from '@nestjs/testing';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiIngestService } from './ai-ingest.service';
import { AiRagService } from './ai-rag.service';
import { AiQueueService } from './ai-queue.service';
import { AiSettingsService } from './ai-settings.service';
import { AiToolRegistryService } from './tool/ai-tool-registry.service';
import { FileStorageService } from '../../common/file-storage/file-storage.service';
import { AiMigrationCheckpointService } from './ai-migration-checkpoint.service';
import { OcrService } from './services/ocr.service';
import { AiPolicyService } from './services/ai-policy.service';
import { AiExecutionProfilesService } from './services/ai-execution-profiles.service';
import { VramMonitorService } from './services/vram-monitor.service';
import { NodeMetricsService } from './services/node-metrics.service';
import { ConfigService } from '@nestjs/config';
import { ValidationException } from '../../common/exceptions';
import { User } from '../user/entities/user.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { AiEnabledGuard } from './guards/ai-enabled.guard';
import { ServiceAccountGuard } from './guards/service-account.guard';

type MockedService = Record<string, jest.Mock>;

function createMockService(methods: string[]): MockedService {
  const mock: MockedService = {};
  for (const m of methods) {
    mock[m] = jest.fn();
  }
  return mock;
}

describe('AiController', () => {
  let controller: AiController;
  let mockAiService: MockedService;
  let mockAiIngestService: MockedService;
  let mockAiRagService: MockedService;
  let mockAiQueueService: MockedService;
  let mockAiSettingsService: MockedService;
  let mockAiToolRegistryService: MockedService;
  let mockFileStorageService: MockedService;
  let mockMigrationCheckpointService: MockedService;
  let mockOcrService: MockedService;
  let mockAiPolicyService: MockedService;
  let mockAiExecutionProfilesService: MockedService;
  let mockVramMonitorService: MockedService;
  let mockNodeMetricsService: MockedService;
  let mockRedis: MockedService;
  let mockConfigService: MockedService;

  const mockUser = { user_id: 1, publicId: 'user-uuid-1' } as User;

  beforeEach(async () => {
    mockAiService = createMockService([
      'queueSuggestJob',
      'getAiJobStatus',
      'submitUnifiedJob',
      'getSystemHealth',
      'clearSandboxData',
      'deleteAuditLogs',
      'getAnalyticsSummary',
      'deleteAuditLogByPublicId',
      'getAiModels',
      'addAiModel',
      'activateAiModel',
      'getVramStatus',
    ]);
    mockAiIngestService = createMockService(['ingest', 'listQueue', 'approve']);
    mockAiRagService = createMockService([
      'getActiveJob',
      'registerActiveJob',
      'getJobResult',
      'cancelJob',
    ]);
    mockAiQueueService = createMockService([
      'getQueueJobs',
      'retryJob',
      'deleteJob',
      'enqueueClearFailed',
      'getClearFailedStatus',
      'enqueueSandboxJob',
      'getBatchQueueSize',
      'enqueueRagQuery',
    ]);
    mockAiSettingsService = createMockService([
      'getAiFeaturesEnabled',
      'setAiFeaturesEnabled',
      'getAvailableModels',
      'getActiveModel',
      'setActiveModel',
      'addModel',
      'toggleModelActive',
      'removeModel',
    ]);
    mockAiToolRegistryService = createMockService(['dispatch']);
    mockFileStorageService = createMockService(['upload']);
    mockMigrationCheckpointService = createMockService([
      'getCheckpoint',
      'saveCheckpoint',
      'upsertQueueRecord',
      'logError',
    ]);
    mockOcrService = createMockService([
      'getOcrEngines',
      'selectOcrEngine',
      'unloadBgeModels',
      'getBgeStatus',
    ]);
    mockAiPolicyService = createMockService([
      'getSandboxParameters',
      'saveSandboxDraft',
      'resetSandboxToProduction',
      'applyProfile',
      'getProfileParameters',
      'getModelDefaults',
    ]);
    mockAiExecutionProfilesService = createMockService([
      'findAll',
      'create',
      'update',
      'delete',
    ]);
    mockVramMonitorService = createMockService([
      'loadModelVram',
      'unloadModelVram',
    ]);
    mockNodeMetricsService = createMockService(['getHostMetrics']);
    mockRedis = createMockService(['get', 'set', 'setex', 'incr']);
    mockConfigService = createMockService(['get']);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        { provide: AiService, useValue: mockAiService },
        { provide: AiIngestService, useValue: mockAiIngestService },
        { provide: AiRagService, useValue: mockAiRagService },
        { provide: AiQueueService, useValue: mockAiQueueService },
        { provide: AiSettingsService, useValue: mockAiSettingsService },
        { provide: AiToolRegistryService, useValue: mockAiToolRegistryService },
        { provide: FileStorageService, useValue: mockFileStorageService },
        {
          provide: AiMigrationCheckpointService,
          useValue: mockMigrationCheckpointService,
        },
        { provide: OcrService, useValue: mockOcrService },
        { provide: AiPolicyService, useValue: mockAiPolicyService },
        {
          provide: AiExecutionProfilesService,
          useValue: mockAiExecutionProfilesService,
        },
        { provide: VramMonitorService, useValue: mockVramMonitorService },
        { provide: NodeMetricsService, useValue: mockNodeMetricsService },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: mockRedis,
        },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RbacGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AiEnabledGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ServiceAccountGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AiController>(AiController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('dispatchIntent', () => {
    it('should return ok=true with data when dispatch succeeds', async () => {
      mockAiToolRegistryService.dispatch.mockResolvedValue({
        ok: true,
        data: { result: 'success' },
      });

      const result = await controller.dispatchIntent(
        {
          intent: 'suggest-metadata',
          projectPublicId: 'proj-uuid',
          params: {},
        },
        mockUser
      );

      expect(result.ok).toBe(true);
      expect(result.data).toEqual({ result: 'success' });
    });

    it('should return ok=false with reason when dispatch fails', async () => {
      mockAiToolRegistryService.dispatch.mockResolvedValue({
        ok: false,
        reason: 'no_handler',
        message: 'No handler found',
      });

      const result = await controller.dispatchIntent(
        { intent: 'unknown', projectPublicId: 'proj-uuid', params: {} },
        mockUser
      );

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('no_handler');
      expect(result.message).toBe('No handler found');
    });
  });

  describe('suggestDocumentMetadata', () => {
    it('should return success=true with jobId when queueSuggestJob succeeds', async () => {
      mockAiService.queueSuggestJob.mockResolvedValue({
        success: true,
        jobId: 'job-123',
      });

      const result = await controller.suggestDocumentMetadata(
        { type: 'rag-query', documentPublicId: 'doc-uuid' },
        'idem-key-1'
      );

      expect(result.success).toBe(true);
      expect(result.jobId).toBe('job-123');
      expect(result.status).toBe('queued');
    });

    it('should return success=false when queueSuggestJob fails', async () => {
      mockAiService.queueSuggestJob.mockResolvedValue({
        success: false,
        jobId: undefined,
      });

      const result = await controller.suggestDocumentMetadata(
        { type: 'rag-query', documentPublicId: 'doc-uuid' },
        'idem-key-1'
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
    });
  });

  describe('getAiJobStatus', () => {
    it('should delegate to aiService.getAiJobStatus', async () => {
      mockAiService.getAiJobStatus.mockResolvedValue({ status: 'completed' });

      const result = await controller.getAiJobStatus('job-123');

      expect(mockAiService.getAiJobStatus).toHaveBeenCalledWith('job-123');
      expect(result).toEqual({ status: 'completed' });
    });
  });

  describe('submitUnifiedJob', () => {
    it('should throw ValidationException when idempotencyKey is missing', async () => {
      let thrown: unknown;
      try {
        await controller.submitUnifiedJob(
          { type: 'rag-query', documentPublicId: 'doc-uuid' },
          ''
        );
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(ValidationException);
    });

    it('should delegate to aiService.submitUnifiedJob when idempotencyKey is provided', async () => {
      mockAiService.submitUnifiedJob.mockResolvedValue({
        jobId: 'job-456',
        status: 'queued',
      });

      const result = await controller.submitUnifiedJob(
        { type: 'rag-query', documentPublicId: 'doc-uuid' },
        'idem-key-1'
      );

      expect(mockAiService.submitUnifiedJob).toHaveBeenCalledWith(
        { type: 'rag-query', documentPublicId: 'doc-uuid' },
        'idem-key-1'
      );
      expect(result.jobId).toBe('job-456');
    });
  });

  describe('getAiJobStatusById', () => {
    it('should delegate to aiService.getAiJobStatus', async () => {
      mockAiService.getAiJobStatus.mockResolvedValue({ status: 'active' });

      const result = await controller.getAiJobStatusById('job-789');

      expect(mockAiService.getAiJobStatus).toHaveBeenCalledWith('job-789');
      expect(result).toEqual({ status: 'active' });
    });
  });

  describe('getAiStatus', () => {
    it('should return aiFeaturesEnabled from settings', async () => {
      mockAiSettingsService.getAiFeaturesEnabled.mockResolvedValue(true);

      const result = await controller.getAiStatus();

      expect(result.aiFeaturesEnabled).toBe(true);
    });
  });

  describe('getAiAdminSettings', () => {
    it('should return aiFeaturesEnabled from settings', async () => {
      mockAiSettingsService.getAiFeaturesEnabled.mockResolvedValue(false);

      const result = await controller.getAiAdminSettings();

      expect(result.aiFeaturesEnabled).toBe(false);
    });
  });

  describe('toggleAiFeatures', () => {
    it('should delegate to aiSettingsService.setAiFeaturesEnabled', async () => {
      mockAiSettingsService.setAiFeaturesEnabled.mockResolvedValue(true);

      const result = await controller.toggleAiFeatures(
        { enabled: true },
        mockUser
      );

      expect(mockAiSettingsService.setAiFeaturesEnabled).toHaveBeenCalledWith(
        true,
        1
      );
      expect(result.aiFeaturesEnabled).toBe(true);
    });
  });

  describe('getAvailableModels', () => {
    it('should return models and activeModel', async () => {
      mockAiSettingsService.getAvailableModels.mockResolvedValue([
        { modelName: 'gemma4:e4b' },
      ]);
      mockAiSettingsService.getActiveModel.mockResolvedValue('gemma4:e4b');

      const result = await controller.getAvailableModels();

      expect(result.models).toHaveLength(1);
      expect(result.activeModel).toBe('gemma4:e4b');
    });
  });

  describe('getActiveModel', () => {
    it('should return activeModel', async () => {
      mockAiSettingsService.getActiveModel.mockResolvedValue('np-dms-ai');

      const result = await controller.getActiveModel();

      expect(result.activeModel).toBe('np-dms-ai');
    });
  });

  describe('setActiveModel', () => {
    it('should delegate to aiSettingsService.setActiveModel', async () => {
      mockAiSettingsService.setActiveModel.mockResolvedValue('gemma4:e4b');

      const result = await controller.setActiveModel(
        { modelName: 'gemma4:e4b' },
        mockUser
      );

      expect(mockAiSettingsService.setActiveModel).toHaveBeenCalledWith(
        'gemma4:e4b',
        1
      );
      expect(result.activeModel).toBe('gemma4:e4b');
    });
  });

  describe('addModel', () => {
    it('should delegate to aiSettingsService.addModel', async () => {
      const dto = {
        modelName: 'gemma4:e4b',
        modelVersion: 'latest',
        description: 'Test model',
      };
      mockAiSettingsService.addModel.mockResolvedValue({
        modelName: 'gemma4:e4b',
      });

      const result = await controller.addModel(dto, mockUser);

      expect(mockAiSettingsService.addModel).toHaveBeenCalledWith(dto, 1);
      expect(result.model).toEqual({ modelName: 'gemma4:e4b' });
    });
  });

  describe('toggleModelActive', () => {
    it('should delegate to aiSettingsService.toggleModelActive', async () => {
      mockAiSettingsService.toggleModelActive.mockResolvedValue({
        isActive: true,
      });

      const result = await controller.toggleModelActive('gemma4:e4b', mockUser);

      expect(mockAiSettingsService.toggleModelActive).toHaveBeenCalledWith(
        'gemma4:e4b',
        1
      );
      expect(result.model).toEqual({ isActive: true });
    });
  });

  describe('removeModel', () => {
    it('should delegate to aiSettingsService.removeModel', async () => {
      mockAiSettingsService.removeModel.mockResolvedValue(undefined);

      await controller.removeModel('gemma4:e4b', mockUser);

      expect(mockAiSettingsService.removeModel).toHaveBeenCalledWith(
        'gemma4:e4b',
        1
      );
    });
  });

  describe('getAiSystemHealth', () => {
    it('should delegate to aiService.getSystemHealth', async () => {
      mockAiService.getSystemHealth.mockResolvedValue({
        ollama: 'healthy',
        qdrant: 'healthy',
      });

      const result = await controller.getAiSystemHealth();

      expect(mockAiService.getSystemHealth).toHaveBeenCalled();
      expect(result).toEqual({ ollama: 'healthy', qdrant: 'healthy' });
    });
  });

  describe('getHostMetrics', () => {
    it('should return metrics when available', async () => {
      const mockMetrics = { cpuPercent: 45.2, ramPercent: 60.1 };
      mockNodeMetricsService.getHostMetrics.mockResolvedValue(mockMetrics);

      const result = await controller.getHostMetrics();

      expect(result).toEqual(mockMetrics);
    });

    it('should return available=false when metrics not yet collected', async () => {
      mockNodeMetricsService.getHostMetrics.mockResolvedValue(null);

      const result = await controller.getHostMetrics();

      expect(result).toEqual({
        available: false,
        reason: expect.stringContaining('NodeMetrics'),
      });
    });
  });

  describe('loadModelVram', () => {
    it('should delegate to vramMonitorService.loadModelVram', async () => {
      mockVramMonitorService.loadModelVram.mockResolvedValue(undefined);

      const result = await controller.loadModelVram('np-dms-ai');

      expect(mockVramMonitorService.loadModelVram).toHaveBeenCalledWith(
        'np-dms-ai'
      );
      expect(result).toEqual({ success: true, modelName: 'np-dms-ai' });
    });
  });

  describe('unloadModelVram', () => {
    it('should delegate to vramMonitorService.unloadModelVram', async () => {
      mockVramMonitorService.unloadModelVram.mockResolvedValue(undefined);

      const result = await controller.unloadModelVram('np-dms-ai');

      expect(mockVramMonitorService.unloadModelVram).toHaveBeenCalledWith(
        'np-dms-ai'
      );
      expect(result.success).toBe(true);
      expect(result.warning).toContain('cold-start');
    });
  });

  describe('unloadBgeModels', () => {
    it('should delegate to ocrService.unloadBgeModels', async () => {
      mockOcrService.unloadBgeModels.mockResolvedValue(undefined);

      const result = await controller.unloadBgeModels();

      expect(mockOcrService.unloadBgeModels).toHaveBeenCalled();
      expect(result.status).toBe('unloaded');
      expect(result.bgeLoaded).toBe(false);
    });
  });

  describe('getBgeStatus', () => {
    it('should delegate to ocrService.getBgeStatus', async () => {
      const mockStatus = {
        bgeLoaded: true,
        rerankerLoaded: false,
        keepAliveSeconds: 600,
        idleSeconds: 30,
        autoUnloadIn: 570,
      };
      mockOcrService.getBgeStatus.mockResolvedValue(mockStatus);

      const result = await controller.getBgeStatus();

      expect(mockOcrService.getBgeStatus).toHaveBeenCalled();
      expect(result).toEqual(mockStatus);
    });
  });

  describe('getQueueJobs', () => {
    it('should delegate to aiQueueService.getQueueJobs with parsed params', async () => {
      mockAiQueueService.getQueueJobs.mockResolvedValue({ jobs: [], total: 0 });

      const result = await controller.getQueueJobs(
        'ai-batch',
        'failed',
        '2',
        '50'
      );

      expect(mockAiQueueService.getQueueJobs).toHaveBeenCalledWith(
        'ai-batch',
        'failed',
        2,
        50
      );
      expect(result.jobs).toEqual([]);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(50);
    });

    it('should clamp page to minimum 1', async () => {
      mockAiQueueService.getQueueJobs.mockResolvedValue({ jobs: [], total: 0 });

      await controller.getQueueJobs('ai-batch', 'all', '0', '20');

      expect(mockAiQueueService.getQueueJobs).toHaveBeenCalledWith(
        'ai-batch',
        'all',
        1,
        20
      );
    });

    it('should clamp limit to maximum 100', async () => {
      mockAiQueueService.getQueueJobs.mockResolvedValue({ jobs: [], total: 0 });

      await controller.getQueueJobs('ai-batch', 'all', '1', '200');

      expect(mockAiQueueService.getQueueJobs).toHaveBeenCalledWith(
        'ai-batch',
        'all',
        1,
        100
      );
    });
  });

  describe('retryQueueJob', () => {
    it('should delegate to aiQueueService.retryJob', async () => {
      mockAiQueueService.retryJob.mockResolvedValue(undefined);

      const result = await controller.retryQueueJob('ai-batch', 'job-123');

      expect(mockAiQueueService.retryJob).toHaveBeenCalledWith(
        'ai-batch',
        'job-123'
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('deleteQueueJob', () => {
    it('should delegate to aiQueueService.deleteJob', async () => {
      mockAiQueueService.deleteJob.mockResolvedValue(undefined);

      await controller.deleteQueueJob('ai-batch', 'job-123');

      expect(mockAiQueueService.deleteJob).toHaveBeenCalledWith(
        'ai-batch',
        'job-123'
      );
    });
  });

  describe('clearFailedJobs', () => {
    it('should delegate to aiQueueService.enqueueClearFailed', async () => {
      mockAiQueueService.enqueueClearFailed.mockResolvedValue('tracking-123');
      const userWithPublicId = { user_id: 1, publicId: 'user-uuid-1' } as User;

      const result = await controller.clearFailedJobs(
        'ai-batch',
        userWithPublicId
      );

      expect(mockAiQueueService.enqueueClearFailed).toHaveBeenCalledWith(
        'ai-batch',
        'user-uuid-1'
      );
      expect(result.jobId).toBe('tracking-123');
      expect(result.status).toBe('queued');
    });
  });

  describe('getClearFailedStatus', () => {
    it('should return result when found', async () => {
      mockAiQueueService.getClearFailedStatus.mockResolvedValue({
        status: 'completed',
        cleared: 5,
      });

      const result = await controller.getClearFailedStatus(
        'ai-batch',
        'tracking-123'
      );

      expect(mockAiQueueService.getClearFailedStatus).toHaveBeenCalledWith(
        'tracking-123'
      );
      expect(result).toEqual({ status: 'completed', cleared: 5 });
    });

    it('should return found=false when result is null', async () => {
      mockAiQueueService.getClearFailedStatus.mockResolvedValue(null);

      const result = await controller.getClearFailedStatus(
        'ai-batch',
        'tracking-999'
      );

      expect(result).toEqual({ found: false });
    });
  });

  describe('submitSandboxRagQuery', () => {
    it('should return existing active job when one exists', async () => {
      mockAiRagService.getActiveJob.mockResolvedValue('existing-job-uuid');

      const result = await controller.submitSandboxRagQuery(
        { projectPublicId: 'proj-uuid', question: 'test' },
        mockUser
      );

      expect(result.requestPublicId).toBe('existing-job-uuid');
      expect(result.status).toBe('queued');
    });

    it('should register and enqueue new job when no active job', async () => {
      mockAiRagService.getActiveJob.mockResolvedValue(null);
      mockAiRagService.registerActiveJob.mockResolvedValue(undefined);
      mockAiQueueService.enqueueSandboxJob.mockResolvedValue('job-id-123');

      const result = await controller.submitSandboxRagQuery(
        { projectPublicId: 'proj-uuid', question: 'test' },
        mockUser
      );

      expect(mockAiRagService.registerActiveJob).toHaveBeenCalled();
      expect(mockAiQueueService.enqueueSandboxJob).toHaveBeenCalledWith(
        'sandbox-rag',
        expect.objectContaining({
          projectPublicId: 'proj-uuid',
          query: 'test',
        })
      );
      expect(result.status).toBe('queued');
    });
  });

  describe('getSandboxJobStatus', () => {
    it('should return result when found', async () => {
      mockAiRagService.getJobResult.mockResolvedValue({
        status: 'completed',
        answer: 'test answer',
      });

      const result = await controller.getSandboxJobStatus('req-uuid-123');

      expect(mockAiRagService.getJobResult).toHaveBeenCalledWith(
        'req-uuid-123'
      );
      expect(result).toEqual({ status: 'completed', answer: 'test answer' });
    });

    it('should return not_found status when result is null', async () => {
      mockAiRagService.getJobResult.mockResolvedValue(null);

      const result = await controller.getSandboxJobStatus('req-uuid-999');

      expect(result).toEqual({
        requestPublicId: 'req-uuid-999',
        status: 'not_found',
      });
    });
  });

  describe('submitSandboxAiExtract', () => {
    it('should delegate to aiQueueService.enqueueSandboxJob', async () => {
      mockAiQueueService.enqueueSandboxJob.mockResolvedValue('job-id-456');

      const result = await controller.submitSandboxAiExtract({
        requestPublicId: 'req-uuid-1',
        projectPublicId: 'proj-uuid',
      });

      expect(mockAiQueueService.enqueueSandboxJob).toHaveBeenCalledWith(
        'sandbox-ai-extract',
        expect.objectContaining({
          idempotencyKey: 'req-uuid-1',
          projectPublicId: 'proj-uuid',
        })
      );
      expect(result.status).toBe('queued');
    });
  });

  describe('submitSandboxRagPrep', () => {
    it('should throw ValidationException when idempotencyKey is missing', async () => {
      let thrown: unknown;
      try {
        await controller.submitSandboxRagPrep(
          { text: 'sample text', profileId: 'standard' },
          ''
        );
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(ValidationException);
    });

    it('should delegate to aiQueueService with idempotencyKey as requestPublicId', async () => {
      mockAiQueueService.enqueueSandboxJob.mockResolvedValue('job-id-789');

      const result = await controller.submitSandboxRagPrep(
        { text: 'sample text', profileId: 'standard' },
        'idem-key-prep'
      );

      expect(mockAiQueueService.enqueueSandboxJob).toHaveBeenCalledWith(
        'sandbox-rag-prep',
        expect.objectContaining({
          idempotencyKey: 'idem-key-prep',
          extraPayload: { text: 'sample text', profileId: 'standard' },
        })
      );
      expect(result.requestPublicId).toBe('idem-key-prep');
    });
  });

  describe('clearSandboxData', () => {
    it('should throw ValidationException when idempotencyKey is missing', async () => {
      let thrown: unknown;
      try {
        await controller.clearSandboxData('');
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(ValidationException);
    });

    it('should delegate to aiService.clearSandboxData', async () => {
      mockAiService.clearSandboxData.mockResolvedValue({
        deletedCorrespondenceCount: 5,
        vectorDeletionJobsEnqueued: 3,
      });

      const result = await controller.clearSandboxData('idem-key-clear');

      expect(mockAiService.clearSandboxData).toHaveBeenCalled();
      expect(result.deletedCorrespondenceCount).toBe(5);
    });
  });

  describe('deleteAuditLogs', () => {
    it('should delegate to aiService.deleteAuditLogs', async () => {
      mockAiService.deleteAuditLogs.mockResolvedValue({ deleted: 10 });

      const result = await controller.deleteAuditLogs({
        documentPublicId: 'doc-uuid',
        olderThanDays: undefined,
      });

      expect(mockAiService.deleteAuditLogs).toHaveBeenCalledWith({
        documentPublicId: 'doc-uuid',
        olderThanDays: undefined,
      });
      expect(result.deleted).toBe(10);
    });
  });

  describe('getAnalyticsSummary', () => {
    it('should delegate to aiService.getAnalyticsSummary', async () => {
      mockAiService.getAnalyticsSummary.mockResolvedValue({
        avgConfidence: 0.85,
        overrideRate: 0.12,
      });

      const result = await controller.getAnalyticsSummary();

      expect(mockAiService.getAnalyticsSummary).toHaveBeenCalled();
      expect(result.avgConfidence).toBe(0.85);
    });
  });

  describe('deleteAuditLogByPublicId', () => {
    it('should delegate to aiService.deleteAuditLogByPublicId', async () => {
      mockAiService.deleteAuditLogByPublicId.mockResolvedValue({
        deleted: true,
        publicId: 'log-uuid-1',
      });

      const result = await controller.deleteAuditLogByPublicId(
        'log-uuid-1',
        mockUser
      );

      expect(mockAiService.deleteAuditLogByPublicId).toHaveBeenCalledWith(
        'log-uuid-1',
        1
      );
      expect(result.deleted).toBe(true);
    });
  });

  describe('submitRagQuery', () => {
    it('should return existing active job when one exists', async () => {
      mockAiRagService.getActiveJob.mockResolvedValue('existing-req-uuid');

      const result = await controller.submitRagQuery(
        { projectPublicId: 'proj-uuid', question: 'test query' },
        mockUser,
        'idem-key-1'
      );

      expect(result.requestPublicId).toBe('existing-req-uuid');
      expect(result.status).toBe('queued');
    });

    it('should register and enqueue new RAG query when no active job', async () => {
      mockAiRagService.getActiveJob.mockResolvedValue(null);
      mockAiRagService.registerActiveJob.mockResolvedValue(undefined);
      mockAiQueueService.enqueueRagQuery.mockResolvedValue('job-id-rag');

      const result = await controller.submitRagQuery(
        { projectPublicId: 'proj-uuid', question: 'test query' },
        mockUser,
        'idem-key-1'
      );

      expect(mockAiRagService.registerActiveJob).toHaveBeenCalled();
      expect(mockAiQueueService.enqueueRagQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          projectPublicId: 'proj-uuid',
          query: 'test query',
        })
      );
      expect(result.status).toBe('queued');
    });
  });

  describe('getRagJobStatus', () => {
    it('should return result when found', async () => {
      mockAiRagService.getJobResult.mockResolvedValue({
        status: 'completed',
        answer: 'answer text',
      });

      const result = await controller.getRagJobStatus('req-uuid-1');

      expect(mockAiRagService.getJobResult).toHaveBeenCalledWith('req-uuid-1');
      expect(result).toEqual({ status: 'completed', answer: 'answer text' });
    });

    it('should return not_found status when result is null', async () => {
      mockAiRagService.getJobResult.mockResolvedValue(null);

      const result = await controller.getRagJobStatus('req-uuid-999');

      expect(result).toEqual({
        requestPublicId: 'req-uuid-999',
        status: 'not_found',
      });
    });
  });

  describe('cancelRagJob', () => {
    it('should delegate to aiRagService.cancelJob', async () => {
      mockAiRagService.cancelJob.mockResolvedValue(undefined);

      await controller.cancelRagJob('req-uuid-1');

      expect(mockAiRagService.cancelJob).toHaveBeenCalledWith('req-uuid-1');
    });
  });

  describe('Execution Profiles', () => {
    it('getExecutionProfiles should delegate to service.findAll', async () => {
      mockAiExecutionProfilesService.findAll.mockResolvedValue([
        { id: 1, name: 'standard' },
      ]);

      const result = await controller.getExecutionProfiles();

      expect(mockAiExecutionProfilesService.findAll).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('createExecutionProfile should delegate to service.create', async () => {
      mockAiExecutionProfilesService.create.mockResolvedValue({
        id: 2,
        name: 'quality',
      });

      const result = await controller.createExecutionProfile(
        { name: 'quality', temperature: 0.3 } as never,
        mockUser
      );

      expect(mockAiExecutionProfilesService.create).toHaveBeenCalledWith(
        { name: 'quality', temperature: 0.3 },
        1
      );
      expect(result.id).toBe(2);
    });

    it('updateExecutionProfile should delegate to service.update', async () => {
      mockAiExecutionProfilesService.update.mockResolvedValue({
        id: 1,
        name: 'updated',
      });

      const result = await controller.updateExecutionProfile(
        '1',
        { name: 'updated' } as never,
        mockUser
      );

      expect(mockAiExecutionProfilesService.update).toHaveBeenCalledWith(
        1,
        { name: 'updated' },
        1
      );
      expect(result.name).toBe('updated');
    });

    it('deleteExecutionProfile should delegate to service.delete', async () => {
      mockAiExecutionProfilesService.delete.mockResolvedValue(undefined);

      await controller.deleteExecutionProfile('1');

      expect(mockAiExecutionProfilesService.delete).toHaveBeenCalledWith(1);
    });
  });

  describe('Migration Checkpoint', () => {
    it('getMigrationCheckpoint should delegate to service', async () => {
      mockMigrationCheckpointService.getCheckpoint.mockResolvedValue({
        batchId: 'batch-1',
        lastProcessed: 100,
      });

      const result = await controller.getMigrationCheckpoint('batch-1');

      expect(mockMigrationCheckpointService.getCheckpoint).toHaveBeenCalledWith(
        'batch-1'
      );
      expect(result.batchId).toBe('batch-1');
    });

    it('saveMigrationCheckpoint should delegate to service', async () => {
      mockMigrationCheckpointService.saveCheckpoint.mockResolvedValue({
        success: true,
      });

      const result = await controller.saveMigrationCheckpoint({
        batchId: 'batch-1',
        lastProcessed: 200,
      } as never);

      expect(mockMigrationCheckpointService.saveCheckpoint).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('upsertMigrationQueueRecord should delegate to service', async () => {
      mockMigrationCheckpointService.upsertQueueRecord.mockResolvedValue({
        success: true,
      });

      const result = await controller.upsertMigrationQueueRecord({
        publicId: 'rec-uuid',
      } as never);

      expect(
        mockMigrationCheckpointService.upsertQueueRecord
      ).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('logMigrationError should delegate to service', async () => {
      mockMigrationCheckpointService.logError.mockResolvedValue({
        success: true,
      });

      const result = await controller.logMigrationError({
        batchId: 'batch-1',
        error: 'test error',
      } as never);

      expect(mockMigrationCheckpointService.logError).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('AI Models & VRAM', () => {
    it('getAiModels should return models and activeModel', async () => {
      mockAiService.getAiModels.mockResolvedValue({
        models: [{ name: 'gemma4' }],
        activeModel: 'gemma4',
      });

      const result = await controller.getAiModels();

      expect(mockAiService.getAiModels).toHaveBeenCalled();
      expect(result.data.models).toHaveLength(1);
      expect(result.data.activeModel).toBe('gemma4');
    });

    it('addAiModel should delegate to aiService.addAiModel', async () => {
      mockAiService.addAiModel.mockResolvedValue({ modelName: 'new-model' });

      const result = await controller.addAiModel(
        { modelName: 'new-model', modelVersion: 'v1' } as never,
        mockUser
      );

      expect(mockAiService.addAiModel).toHaveBeenCalledWith(
        { modelName: 'new-model', modelVersion: 'v1' },
        1
      );
      expect(result.data).toEqual({ modelName: 'new-model' });
    });

    it('activateAiModel should delegate to aiService.activateAiModel', async () => {
      mockAiService.activateAiModel.mockResolvedValue('activated-model');

      const result = await controller.activateAiModel('model-1', {}, mockUser);

      expect(mockAiService.activateAiModel).toHaveBeenCalledWith(
        { modelId: 'model-1' },
        1
      );
      expect(result.data.activeModel).toBe('activated-model');
    });

    it('getVramStatus should delegate to aiService.getVramStatus', async () => {
      mockAiService.getVramStatus.mockResolvedValue({
        totalVram: 24576,
        usedVram: 12000,
      });

      const result = await controller.getVramStatus();

      expect(mockAiService.getVramStatus).toHaveBeenCalled();
      expect(result.data.totalVram).toBe(24576);
    });
  });

  describe('OCR Engines', () => {
    it('getOcrEngines should delegate to ocrService.getOcrEngines', async () => {
      mockOcrService.getOcrEngines.mockResolvedValue([
        { engineId: 'engine-1', name: 'Tesseract' },
      ]);

      const result = await controller.getOcrEngines();

      expect(mockOcrService.getOcrEngines).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('selectOcrEngine should delegate to ocrService.selectOcrEngine', async () => {
      mockOcrService.selectOcrEngine.mockResolvedValue({
        engineId: 'engine-1',
        isSelected: true,
      });

      const result = await controller.selectOcrEngine(
        'engine-uuid-1',
        mockUser
      );

      expect(mockOcrService.selectOcrEngine).toHaveBeenCalledWith(
        'engine-uuid-1',
        1
      );
      expect(result.isSelected).toBe(true);
    });
  });

  describe('Sandbox Profiles', () => {
    it('getSandboxProfile should delegate to aiPolicyService.getSandboxParameters', async () => {
      mockAiPolicyService.getSandboxParameters.mockResolvedValue({
        temperature: 0.5,
      });

      const result = await controller.getSandboxProfile('standard');

      expect(mockAiPolicyService.getSandboxParameters).toHaveBeenCalledWith(
        'standard'
      );
      expect(result).toEqual({ temperature: 0.5 });
    });

    it('saveSandboxProfile should throw ValidationException when idempotencyKey is missing', async () => {
      let thrown: unknown;
      try {
        await controller.saveSandboxProfile(
          'standard',
          { temperature: 0.7 },
          mockUser,
          ''
        );
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(ValidationException);
    });

    it('saveSandboxProfile should delegate to aiPolicyService.saveSandboxDraft', async () => {
      mockAiPolicyService.saveSandboxDraft.mockResolvedValue({
        temperature: 0.7,
      });

      const result = await controller.saveSandboxProfile(
        'standard',
        { temperature: 0.7 },
        mockUser,
        'idem-key-1'
      );

      expect(mockAiPolicyService.saveSandboxDraft).toHaveBeenCalledWith(
        'standard',
        { temperature: 0.7 },
        1
      );
      expect(result).toEqual({ temperature: 0.7 });
    });

    it('resetSandboxProfile should delegate to aiPolicyService.resetSandboxToProduction', async () => {
      mockAiPolicyService.resetSandboxToProduction.mockResolvedValue({
        temperature: 0.3,
      });

      const result = await controller.resetSandboxProfile('standard', mockUser);

      expect(mockAiPolicyService.resetSandboxToProduction).toHaveBeenCalledWith(
        'standard',
        1
      );
      expect(result).toEqual({ temperature: 0.3 });
    });
  });

  describe('applyProfile', () => {
    it('should throw ValidationException when idempotencyKey is missing', async () => {
      let thrown: unknown;
      try {
        await controller.applyProfile('standard', mockUser, '');
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(ValidationException);
    });

    it('should return cached result from Redis when available', async () => {
      const cachedPolicy = { temperature: 0.5, canonicalModel: 'np-dms-ai' };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedPolicy));

      const result = await controller.applyProfile(
        'standard',
        mockUser,
        'idem-key-1'
      );

      expect(mockRedis.get).toHaveBeenCalledWith(
        'idempotency:apply-profile:idem-key-1'
      );
      expect(mockAiPolicyService.applyProfile).not.toHaveBeenCalled();
      expect(result).toEqual(cachedPolicy);
    });

    it('should delegate to aiPolicyService.applyProfile when no cache', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockAiPolicyService.applyProfile.mockResolvedValue({
        temperature: 0.5,
      });
      mockRedis.set.mockResolvedValue('OK');

      const result = await controller.applyProfile(
        'standard',
        mockUser,
        'idem-key-2'
      );

      expect(mockAiPolicyService.applyProfile).toHaveBeenCalledWith(
        'standard',
        1
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        'idempotency:apply-profile:idem-key-2',
        expect.any(String),
        'EX',
        300
      );
      expect(result).toEqual({ temperature: 0.5 });
    });
  });

  describe('getProductionProfile', () => {
    it('should return ocr defaults for ocr-extract profile', async () => {
      mockAiPolicyService.getModelDefaults.mockResolvedValue({
        canonicalModel: 'np-dms-ocr',
        temperature: 0.1,
      });

      const result = await controller.getProductionProfile('ocr-extract');

      expect(mockAiPolicyService.getModelDefaults).toHaveBeenCalledWith(
        'np-dms-ocr'
      );
      expect(result.canonicalModel).toBe('np-dms-ocr');
    });

    it('should return profile parameters for valid profile', async () => {
      mockAiPolicyService.getProfileParameters.mockResolvedValue({
        temperature: 0.5,
      });

      const result = await controller.getProductionProfile('standard');

      expect(mockAiPolicyService.getProfileParameters).toHaveBeenCalledWith(
        'standard'
      );
      expect(result).toEqual({ temperature: 0.5 });
    });

    it('should throw ValidationException for invalid profile name', async () => {
      let thrown: unknown;
      try {
        await controller.getProductionProfile('invalid-profile');
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(ValidationException);
    });
  });

  describe('Legacy Migration', () => {
    it('getLegacyMigrationQueue should delegate to aiIngestService.listQueue', async () => {
      mockAiIngestService.listQueue.mockResolvedValue({
        data: [],
        total: 0,
      });

      const result = await controller.getLegacyMigrationQueue({
        page: 1,
        limit: 20,
      } as never);

      expect(mockAiIngestService.listQueue).toHaveBeenCalled();
      expect(result.total).toBe(0);
    });

    it('approveLegacyMigrationRecord should delegate to aiIngestService.approve', async () => {
      mockAiIngestService.approve.mockResolvedValue({
        record: { publicId: 'rec-uuid' },
        importResult: { success: true },
      });

      const result = await controller.approveLegacyMigrationRecord(
        'rec-uuid',
        { approved: true } as never,
        'idem-key-1',
        mockUser
      );

      expect(mockAiIngestService.approve).toHaveBeenCalledWith(
        'rec-uuid',
        { approved: true },
        'idem-key-1',
        1
      );
      expect(result.record.publicId).toBe('rec-uuid');
    });

    it('should throw ValidationException for invalid profile name', async () => {
      let thrown: unknown;
      try {
        await controller.getProductionProfile('invalid-profile');
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(ValidationException);
    });
  });

  describe('Legacy Migration', () => {
    it('getLegacyMigrationQueue should delegate to aiIngestService.listQueue', async () => {
      mockAiIngestService.listQueue.mockResolvedValue({
        data: [],
        total: 0,
      });

      const result = await controller.getLegacyMigrationQueue({
        page: 1,
        limit: 20,
      } as never);

      expect(mockAiIngestService.listQueue).toHaveBeenCalled();
      expect(result.total).toBe(0);
    });

    it('approveLegacyMigrationRecord should delegate to aiIngestService.approve', async () => {
      mockAiIngestService.approve.mockResolvedValue({
        record: { publicId: 'rec-uuid' },
        importResult: { success: true },
      });

      const result = await controller.approveLegacyMigrationRecord(
        'rec-uuid',
        { approved: true } as never,
        'idem-key-1',
        mockUser
      );

      expect(mockAiIngestService.approve).toHaveBeenCalledWith(
        'rec-uuid',
        { approved: true },
        'idem-key-1',
        1
      );
      expect(result.record.publicId).toBe('rec-uuid');
    });
  });
});
