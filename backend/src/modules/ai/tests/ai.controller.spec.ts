// File: backend/src/modules/ai/tests/ai.controller.spec.ts
// Change Log:
// - 2026-06-11: สร้าง integration tests สำหรับ AiController forbidden fields (US5)
// - 2026-06-11: เพิ่ม ConfigService mock และ override ServiceAccountGuard เพื่อแก้ DI error
// - 2026-06-11: แก้ไขการ import supertest ให้ถูกต้อง เพื่อป้องกัน TypeError: request is not a function
// - 2026-06-11: แก้ไขการตรวจสอบ message array ในการทดสอบ validation ให้ถูกต้อง
// - 2026-06-11: แก้ไข ESLint unsafe argument/member access errors ใน integration tests
// - 2026-06-11: เพิ่ม mock 'default_IORedisModuleConnectionToken' เพื่อแก้ปัญหา NestJS DI และลบบรรทัดว่างในฟังก์ชัน
// - 2026-06-13: เพิ่ม mock AiPolicyService ใน providers เพื่อแก้ปัญหา NestJS DI
// - 2026-06-13: Polish — ป้องกัน eslint unsafe member access ใน mockGuard.canActivate โดยใช้ type casting

import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  ExecutionContext,
} from '@nestjs/common';
import request from 'supertest';
import { AiController } from '../ai.controller';
import { AiService } from '../ai.service';
import { AiIngestService } from '../ai-ingest.service';
import { AiRagService } from '../ai-rag.service';
import { AiQueueService } from '../ai-queue.service';
import { AiSettingsService } from '../ai-settings.service';
import { AiToolRegistryService } from '../tool/ai-tool-registry.service';
import { FileStorageService } from '../../../common/file-storage/file-storage.service';
import { AiMigrationCheckpointService } from '../ai-migration-checkpoint.service';
import { OcrService } from '../services/ocr.service';
import { AiPolicyService } from '../services/ai-policy.service';
import { AiExecutionProfilesService } from '../services/ai-execution-profiles.service';
import { RuntimePolicy } from '../interfaces/execution-policy.interface';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { AiEnabledGuard } from '../guards/ai-enabled.guard';
import { ServiceAccountGuard } from '../guards/service-account.guard';
import { ConfigService } from '@nestjs/config';

describe('AiController (Integration)', () => {
  let app: INestApplication;
  const mockGuard = {
    canActivate: (context: ExecutionContext) => {
      const req = context
        .switchToHttp()
        .getRequest<{ user: { user_id: number; username: string } }>();
      req.user = { user_id: 1, username: 'testuser' };
      return true;
    },
  };
  const mockAiService = {
    submitUnifiedJob: jest.fn().mockResolvedValue({
      jobId: 'job-123',
      status: 'queued',
      effectiveProfile: 'standard',
      modelUsed: 'np-dms-ai',
    }),
  };
  const mockAiIngestService = {};
  const mockAiRagService = {};
  const mockAiQueueService = {};
  const mockAiSettingsService = {};
  const mockAiToolRegistryService = {};
  const mockFileStorageService = {};
  const mockMigrationCheckpointService = {};
  const mockOcrService = {};
  const mockAiPolicyService = {
    applyProfile: jest.fn(),
    getProfileParameters: jest.fn(),
    getModelDefaults: jest.fn(),
  };
  const mockAiExecutionProfilesService = {};
  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleFixture: TestingModule = await Test.createTestingModule({
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
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue('OK'),
            del: jest.fn().mockResolvedValue(1),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'AI_ENABLED') return 'true';
              return null;
            }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(RbacGuard)
      .useValue(mockGuard)
      .overrideGuard(AiEnabledGuard)
      .useValue(mockGuard)
      .overrideGuard(ServiceAccountGuard)
      .useValue(mockGuard)
      .compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      })
    );
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });
  describe('POST /ai/jobs - Validation', () => {
    it('ควรส่งผ่านเมื่อส่ง payload ที่ถูกต้อง (ไม่มี executionProfile, model, temperature ฯลฯ)', async () => {
      const validPayload = {
        type: 'rag-query',
        documentPublicId: '019505a1-7c3e-7000-8000-abc123def456',
        payload: { query: 'test' },
      };
      const response = await request(app.getHttpServer() as () => void)
        .post('/ai/jobs')
        .set('idempotency-key', 'key-123')
        .send(validPayload);
      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        jobId: 'job-123',
        status: 'queued',
        effectiveProfile: 'standard',
        modelUsed: 'np-dms-ai',
      });
      expect(mockAiService.submitUnifiedJob).toHaveBeenCalled();
    });
    it('ควรคืนสถานะ 400 Bad Request เมื่อส่ง executionProfile มาใน payload', async () => {
      const invalidPayload = {
        type: 'rag-query',
        documentPublicId: '019505a1-7c3e-7000-8000-abc123def456',
        executionProfile: 'quality',
      };
      const response = await request(app.getHttpServer() as () => void)
        .post('/ai/jobs')
        .set('idempotency-key', 'key-123')
        .send(invalidPayload);
      expect(response.status).toBe(400);
      const body = response.body as { message: string[] };
      expect(body.message[0]).toContain(
        'executionProfile is forbidden in payload'
      );
    });
    it('ควรคืนสถานะ 400 Bad Request เมื่อส่ง model มาใน payload', async () => {
      const invalidPayload = {
        type: 'rag-query',
        documentPublicId: '019505a1-7c3e-7000-8000-abc123def456',
        model: { key: 'custom' },
      };
      const response = await request(app.getHttpServer() as () => void)
        .post('/ai/jobs')
        .set('idempotency-key', 'key-123')
        .send(invalidPayload);
      expect(response.status).toBe(400);
      const body = response.body as { message: string[] };
      expect(body.message[0]).toContain('model is forbidden in payload');
    });
    it('ควรคืนสถานะ 400 Bad Request เมื่อส่ง temperature มาใน payload', async () => {
      const invalidPayload = {
        type: 'rag-query',
        documentPublicId: '019505a1-7c3e-7000-8000-abc123def456',
        temperature: 0.7,
      };
      const response = await request(app.getHttpServer() as () => void)
        .post('/ai/jobs')
        .set('idempotency-key', 'key-123')
        .send(invalidPayload);
      expect(response.status).toBe(400);
      const body = response.body as { message: string[] };
      expect(body.message[0]).toContain('temperature is forbidden in payload');
    });
  });

  describe('Sandbox-Production Parity Endpoints', () => {
    const mockRuntimePolicy: RuntimePolicy = {
      canonicalModel: 'np-dms-ai',
      temperature: 0.5,
      topP: 0.8,
      maxTokens: 4096,
      numCtx: 8192,
      repeatPenalty: 1.15,
      keepAliveSeconds: 600,
    };

    describe('POST /ai/profiles/:profileName/apply', () => {
      beforeEach(() => {
        mockAiPolicyService.applyProfile.mockReset();
        mockAiPolicyService.applyProfile.mockResolvedValue(mockRuntimePolicy);
      });

      it('ควรปรับใช้ sandbox profile ไปยัง production สำเร็จเมื่อส่ง Idempotency-Key ครบถ้วน', async () => {
        const response = await request(app.getHttpServer() as () => void)
          .post('/ai/profiles/standard/apply')
          .set('idempotency-key', 'key-apply-123');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockRuntimePolicy);
        expect(mockAiPolicyService.applyProfile).toHaveBeenCalledWith(
          'standard',
          expect.any(Number)
        );
      });

      it('ควรคืนสถานะ 400 Bad Request เมื่อไม่ส่ง Idempotency-Key', async () => {
        const response = await request(app.getHttpServer() as () => void).post(
          '/ai/profiles/standard/apply'
        );

        expect(response.status).toBe(400);
        const body = response.body as { error?: { technicalMessage?: string } };
        expect(body.error?.technicalMessage).toContain(
          'Idempotency-Key header is required'
        );
      });

      it('ควรคืนค่า cached result เมื่อเรียกซ้ำด้วย Idempotency-Key เดิม', async () => {
        const mockRedisGet = jest.spyOn(
          app.get('default_IORedisModuleConnectionToken'),
          'get'
        );
        mockRedisGet.mockResolvedValueOnce(JSON.stringify(mockRuntimePolicy));

        const response = await request(app.getHttpServer() as () => void)
          .post('/ai/profiles/standard/apply')
          .set('idempotency-key', 'key-apply-cached');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockRuntimePolicy);
        expect(mockAiPolicyService.applyProfile).not.toHaveBeenCalled();
      });
    });

    describe('GET /ai/profiles/:profileName', () => {
      beforeEach(() => {
        mockAiPolicyService.getProfileParameters.mockReset();
        mockAiPolicyService.getModelDefaults.mockReset();
      });

      it('ควรคืนค่า production profile parameters สำเร็จ', async () => {
        mockAiPolicyService.getProfileParameters.mockResolvedValue(
          mockRuntimePolicy
        );

        const response = await request(app.getHttpServer() as () => void).get(
          '/ai/profiles/standard'
        );

        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockRuntimePolicy);
        expect(mockAiPolicyService.getProfileParameters).toHaveBeenCalledWith(
          'standard'
        );
      });

      it('ควรคืนค่า defaults ของ ocr-extract สำหรับ profileName ocr-extract', async () => {
        const mockOcrPolicy = {
          canonicalModel: 'np-dms-ocr',
          temperature: 0.1,
          topP: 0.1,
          repeatPenalty: 1.1,
          keepAliveSeconds: 0,
        };
        mockAiPolicyService.getModelDefaults.mockResolvedValue(mockOcrPolicy);

        const response = await request(app.getHttpServer() as () => void).get(
          '/ai/profiles/ocr-extract'
        );

        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockOcrPolicy);
        expect(mockAiPolicyService.getModelDefaults).toHaveBeenCalledWith(
          'np-dms-ocr'
        );
      });
    });
  });
});
