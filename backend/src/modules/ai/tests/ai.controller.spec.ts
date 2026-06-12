// File: backend/src/modules/ai/tests/ai.controller.spec.ts
// Change Log:
// - 2026-06-11: สร้าง integration tests สำหรับ AiController forbidden fields (US5)
// - 2026-06-11: เพิ่ม ConfigService mock และ override ServiceAccountGuard เพื่อแก้ DI error
// - 2026-06-11: แก้ไขการ import supertest ให้ถูกต้อง เพื่อป้องกัน TypeError: request is not a function
// - 2026-06-11: แก้ไขการตรวจสอบ message array ในการทดสอบ validation ให้ถูกต้อง
// - 2026-06-11: แก้ไข ESLint unsafe argument/member access errors ใน integration tests
// - 2026-06-11: เพิ่ม mock 'default_IORedisModuleConnectionToken' เพื่อแก้ปัญหา NestJS DI และลบบรรทัดว่างในฟังก์ชัน

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
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
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { AiEnabledGuard } from '../guards/ai-enabled.guard';
import { ServiceAccountGuard } from '../guards/service-account.guard';
import { ConfigService } from '@nestjs/config';

describe('AiController (Integration)', () => {
  let app: INestApplication;
  const mockGuard = { canActivate: () => true };
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
});
