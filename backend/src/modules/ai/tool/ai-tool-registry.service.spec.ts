// File: src/modules/ai/tool/ai-tool-registry.service.spec.ts
// Change Log
// - 2026-05-19: สร้าง Unit Test สำหรับ AiToolRegistryService (ADR-025).

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AiToolRegistryService } from './ai-tool-registry.service';
import { RfaToolService } from './rfa-tool.service';
import { DrawingToolService } from './drawing-tool.service';
import { TransmittalToolService } from './transmittal-tool.service';
import { AiAuditLog, AiAuditStatus } from '../entities/ai-audit-log.entity';
import { ServerIntent } from './types/server-intent.enum';
import { ToolHandlerContext } from './types/tool-handler-context.type';
import { User } from '../../user/entities/user.entity';

/**
 * Mock User สำหรับ Unit Test
 * ไม่มี assignments → CASL deny ทุก action (ทดสอบ FORBIDDEN case)
 */
const mockUser = {
  user_id: 1,
  publicId: 'test-uuid-user',
  assignments: [],
} as unknown as User;

/** Context มาตรฐานสำหรับ test */
const mockContext: ToolHandlerContext = {
  requestUser: mockUser,
  projectPublicId: '0195a1b2-c3d4-7000-8000-abc123def456',
};

const mockAuditLogRepo = {
  create: jest.fn().mockReturnValue({}),
  save: jest.fn().mockResolvedValue({}),
};

const mockRfaToolService = {
  getRfa: jest
    .fn()
    .mockResolvedValue({ ok: true, data: [{ publicId: 'rfa-uuid' }] }),
};

const mockDrawingToolService = {
  getDrawing: jest
    .fn()
    .mockResolvedValue({ ok: true, data: [{ publicId: 'drawing-uuid' }] }),
};

const mockTransmittalToolService = {
  getTransmittal: jest
    .fn()
    .mockResolvedValue({ ok: true, data: [{ publicId: 'transmittal-uuid' }] }),
};

describe('AiToolRegistryService', () => {
  let service: AiToolRegistryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiToolRegistryService,
        { provide: RfaToolService, useValue: mockRfaToolService },
        { provide: DrawingToolService, useValue: mockDrawingToolService },
        {
          provide: TransmittalToolService,
          useValue: mockTransmittalToolService,
        },
        {
          provide: getRepositoryToken(AiAuditLog),
          useValue: mockAuditLogRepo,
        },
      ],
    }).compile();
    service = module.get<AiToolRegistryService>(AiToolRegistryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getHandler()', () => {
    it('ควรคืน handler สำหรับ GET_RFA', () => {
      const handler = service.getHandler(ServerIntent.GET_RFA);
      expect(handler).toBeDefined();
    });

    it('ควรคืน handler สำหรับ GET_DRAWING', () => {
      const handler = service.getHandler(ServerIntent.GET_DRAWING);
      expect(handler).toBeDefined();
    });

    it('ควรคืน handler สำหรับ GET_TRANSMITTAL', () => {
      const handler = service.getHandler(ServerIntent.GET_TRANSMITTAL);
      expect(handler).toBeDefined();
    });

    it('ควรคืน undefined สำหรับ intent ที่ไม่มีใน registry', () => {
      const handler = service.getHandler('UNKNOWN_INTENT' as ServerIntent);
      expect(handler).toBeUndefined();
    });
  });

  describe('dispatch()', () => {
    it('ควร dispatch GET_RFA และคืนผลลัพธ์ถูกต้อง', async () => {
      const result = await service.dispatch(ServerIntent.GET_RFA, mockContext);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(Array.isArray(result.data)).toBe(true);
      }
      expect(mockRfaToolService.getRfa).toHaveBeenCalledWith(mockContext);
    });

    it('ควรคืน INVALID_PARAMS เมื่อ intent ไม่มีใน registry', async () => {
      const result = await service.dispatch('UNKNOWN_INTENT', mockContext);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('INVALID_PARAMS');
      }
    });

    it('ควรบันทึก AuditLog ทุก dispatch', async () => {
      await service.dispatch(ServerIntent.GET_RFA, mockContext);
      expect(mockAuditLogRepo.create).toHaveBeenCalled();
      expect(mockAuditLogRepo.save).toHaveBeenCalled();
    });

    it('ควรคืน SERVICE_ERROR เมื่อ handler โยน exception', async () => {
      mockRfaToolService.getRfa.mockRejectedValueOnce(
        new Error('DB connection failed')
      );
      const result = await service.dispatch(ServerIntent.GET_RFA, mockContext);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('SERVICE_ERROR');
      }
    });

    it('ควรบันทึก AuditLog status=FAILED เมื่อ handler คืน ok: false', async () => {
      mockRfaToolService.getRfa.mockResolvedValueOnce({
        ok: false,
        reason: 'FORBIDDEN',
        message: 'No permission',
      });
      await service.dispatch(ServerIntent.GET_RFA, mockContext);
      expect(mockAuditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: AiAuditStatus.FAILED,
        })
      );
    });
  });
});
