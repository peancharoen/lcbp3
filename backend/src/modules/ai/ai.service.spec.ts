// File: src/modules/ai/ai.service.spec.ts
// Unit Tests สำหรับ AiService — ทดสอบ Business Logic สำคัญ: Callback, Update, Status Transitions

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { AiValidationService } from './ai-validation.service';
import {
  MigrationLog,
  MigrationLogStatus,
} from './entities/migration-log.entity';
import { AiAuditLog, AiAuditStatus } from './entities/ai-audit-log.entity';
import { AiCallbackDto } from './dto/ai-callback.dto';
import { MigrationUpdateDto } from './dto/migration-update.dto';
import { NotFoundException, BusinessException } from '../../common/exceptions';

describe('AiService', () => {
  let service: AiService;

  // Mock Repositories
  const mockMigrationLogRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    }),
  };

  const mockAuditLogRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  // Mock ConfigService — คืนค่า Config ตาม Key
  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string | number> = {
        AI_N8N_WEBHOOK_URL: 'http://localhost:5678/webhook/test',
        AI_N8N_AUTH_TOKEN: 'test-token',
        AI_TIMEOUT_MS: 30000,
        APP_BASE_URL: 'http://localhost:3001',
      };
      return config[key];
    }),
  };

  // Mock HttpService (ไม่ต้องการ HTTP call จริงใน Unit Test)
  const mockHttpService = {
    post: jest.fn(),
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

    // ตั้งค่า default return values
    mockMigrationLogRepo.create.mockReturnValue({
      publicId: '019505a1-7c3e-7000-8000-abc123def456',
      sourceFile: 'test-file-uuid',
      status: MigrationLogStatus.PENDING_REVIEW,
    });
    mockMigrationLogRepo.save.mockImplementation((entity) =>
      Promise.resolve({ ...entity, id: 1 })
    );
    mockAuditLogRepo.create.mockReturnValue({});
    mockAuditLogRepo.save.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: getRepositoryToken(MigrationLog),
          useValue: mockMigrationLogRepo,
        },
        { provide: getRepositoryToken(AiAuditLog), useValue: mockAuditLogRepo },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: HttpService, useValue: mockHttpService },
        { provide: AiValidationService, useValue: mockValidationService },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- handleWebhookCallback ---

  describe('handleWebhookCallback', () => {
    const validPayload: AiCallbackDto = {
      migrationLogPublicId: '019505a1-7c3e-7000-8000-abc123def456',
      aiModel: 'gemma4',
      status: AiAuditStatus.SUCCESS,
      confidenceScore: 0.92,
      extractedMetadata: { subject: 'Test', discipline: 'Civil' },
      processingTimeMs: 5000,
    };

    const validAuthHeader = 'Bearer test-token';

    it('ควรปฏิเสธ request เมื่อไม่มี Authorization header', async () => {
      await expect(
        service.handleWebhookCallback(validPayload, 'n8n', '')
      ).rejects.toThrow();
    });

    it('ควรปฏิเสธ request เมื่อ Token ไม่ถูกต้อง', async () => {
      await expect(
        service.handleWebhookCallback(validPayload, 'n8n', 'Bearer wrong-token')
      ).rejects.toThrow();
    });

    it('ควร throw NotFoundException เมื่อ MigrationLog ไม่พบ', async () => {
      mockMigrationLogRepo.findOne.mockResolvedValue(null);
      mockValidationService.validateAiOutput.mockReturnValue({
        isValid: true,
        action: 'low_priority_review',
        confidence: 0.92,
        reasons: [],
      });

      await expect(
        service.handleWebhookCallback(validPayload, 'n8n', validAuthHeader)
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('ควรอัปเดต MigrationLog เมื่อ Callback ถูกต้อง', async () => {
      const existingLog = {
        id: 1,
        publicId: '019505a1-7c3e-7000-8000-abc123def456',
        status: MigrationLogStatus.PENDING_REVIEW,
        sourceFile: 'test.pdf',
        save: jest.fn(),
      };

      mockMigrationLogRepo.findOne.mockResolvedValue(existingLog);
      mockValidationService.validateAiOutput.mockReturnValue({
        isValid: true,
        action: 'low_priority_review',
        confidence: 0.92,
        reasons: [],
      });

      await service.handleWebhookCallback(validPayload, 'n8n', validAuthHeader);

      expect(mockMigrationLogRepo.save).toHaveBeenCalled();
      expect(mockAuditLogRepo.create).toHaveBeenCalled();
    });

    it('ควร Auto-approve เมื่อ confidence >= 0.95', async () => {
      const highConfidencePayload = { ...validPayload, confidenceScore: 0.97 };
      const existingLog = {
        id: 1,
        publicId: '019505a1-7c3e-7000-8000-abc123def456',
        status: MigrationLogStatus.PENDING_REVIEW,
        sourceFile: 'test.pdf',
      };

      mockMigrationLogRepo.findOne.mockResolvedValue(existingLog);

      mockValidationService.validateAiOutput.mockReturnValue({
        isValid: true,
        action: 'auto_approve',
        confidence: 0.97,
        reasons: [],
      });

      await service.handleWebhookCallback(
        highConfidencePayload,
        'n8n',
        validAuthHeader
      );

      const calls = mockMigrationLogRepo.save.mock.calls as [MigrationLog][];
      const savedLog = calls[0][0];
      expect(savedLog.status).toBe(MigrationLogStatus.VERIFIED);
    });

    it('ควรตั้งสถานะ FAILED เมื่อ AI ล้มเหลว', async () => {
      const failedPayload = {
        ...validPayload,
        status: AiAuditStatus.FAILED,
        errorMessage: 'OCR timeout',
      };
      const existingLog = {
        id: 1,
        publicId: '019505a1-7c3e-7000-8000-abc123def456',
        status: MigrationLogStatus.PENDING_REVIEW,
        sourceFile: 'test.pdf',
      };

      mockMigrationLogRepo.findOne.mockResolvedValue(existingLog);
      mockValidationService.validateAiOutput.mockReturnValue({
        isValid: false,
        action: 'reject',
        confidence: 0,
        reasons: ['AI processing failed'],
      });

      await service.handleWebhookCallback(
        failedPayload,
        'n8n',
        validAuthHeader
      );

      const calls = mockMigrationLogRepo.save.mock.calls as [MigrationLog][];
      const savedLog = calls[0][0];
      expect(savedLog.status).toBe(MigrationLogStatus.FAILED);
    });
  });

  // --- updateMigrationLog ---

  describe('updateMigrationLog', () => {
    const publicId = '019505a1-7c3e-7000-8000-abc123def456';

    it('ควร throw NotFoundException เมื่อ MigrationLog ไม่พบ', async () => {
      mockMigrationLogRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateMigrationLog(publicId, {}, 1)
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('ควรอัปเดตสถานะ PENDING_REVIEW → VERIFIED ได้', async () => {
      const existingLog = {
        id: 1,
        publicId,
        status: MigrationLogStatus.PENDING_REVIEW,
        sourceFile: 'test.pdf',
      };

      mockMigrationLogRepo.findOne.mockResolvedValue(existingLog);
      mockMigrationLogRepo.save.mockImplementation((entity) =>
        Promise.resolve({ ...entity })
      );

      const dto: MigrationUpdateDto = { status: MigrationLogStatus.VERIFIED };
      const result = await service.updateMigrationLog(publicId, dto, 5);

      expect(result.status).toBe(MigrationLogStatus.VERIFIED);
      expect(result.reviewedBy).toBe(5);
    });

    it('ควร throw BusinessException เมื่อ State Transition ไม่ถูกต้อง (IMPORTED → VERIFIED)', async () => {
      const existingLog = {
        id: 1,
        publicId,
        status: MigrationLogStatus.IMPORTED, // Terminal State
        sourceFile: 'test.pdf',
      };

      mockMigrationLogRepo.findOne.mockResolvedValue(existingLog);

      const dto: MigrationUpdateDto = { status: MigrationLogStatus.VERIFIED };

      await expect(
        service.updateMigrationLog(publicId, dto, 1)
      ).rejects.toBeInstanceOf(BusinessException);
    });

    it('ควรอัปเดต adminFeedback ได้โดยไม่ต้องเปลี่ยนสถานะ', async () => {
      const existingLog = {
        id: 1,
        publicId,
        status: MigrationLogStatus.PENDING_REVIEW,
        sourceFile: 'test.pdf',
        adminFeedback: undefined,
      };

      mockMigrationLogRepo.findOne.mockResolvedValue(existingLog);
      mockMigrationLogRepo.save.mockImplementation((entity) =>
        Promise.resolve({ ...entity })
      );

      const dto: MigrationUpdateDto = {
        adminFeedback: 'ตรวจสอบแล้ว ข้อมูลถูกต้อง',
      };
      const result = await service.updateMigrationLog(publicId, dto, 3);

      expect(result.adminFeedback).toBe('ตรวจสอบแล้ว ข้อมูลถูกต้อง');
      expect(result.status).toBe(MigrationLogStatus.PENDING_REVIEW);
    });
  });

  // --- getMigrationList ---

  describe('getMigrationList', () => {
    it('ควรคืน paginated result', async () => {
      const result = await service.getMigrationList({ page: 1, limit: 10 });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('limit', 10);
      expect(result).toHaveProperty('totalPages');
    });
  });
});
