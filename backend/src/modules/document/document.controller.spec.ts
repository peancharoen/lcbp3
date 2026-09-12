// File: backend/src/modules/document/document.controller.spec.ts
// Change Log:
// - 2026-09-12: Unit tests สำหรับ DocumentController (Feature 253 — Phase 2A, FR-016 to FR-020)

import { Test, type TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { ValidationException } from '../../common/exceptions/base.exception';
import { User } from '../user/entities/user.entity';
import { BulkCancelRequestDto } from '../../common/dto/bulk-cancel.dto';
import { BulkTagRequestDto } from '../../common/dto/bulk-tag.dto';
import { BulkExportRequestDto } from '../../common/dto/bulk-export.dto';

/**
 * Unit tests สำหรับ DocumentController — Feature 253 Phase 2A
 * ครอบคลุม FR-016 to FR-020: Bulk Cancel / Tag / Export + Idempotency-Key + RBAC
 */
describe('DocumentController (Feature 253 — Phase 2A)', () => {
  let controller: DocumentController;
  let documentService: jest.Mocked<DocumentService>;

  const mockUser = {
    user_id: 42,
    publicId: '01a01992-8420-7d9b-8f9b-a89b52cb48bd',
  } as User;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentController],
      providers: [
        {
          provide: DocumentService,
          useValue: {
            bulkCancel: jest
              .fn()
              .mockResolvedValue({ bulkId: 'bulk-uuid-123' }),
            bulkTag: jest.fn().mockResolvedValue({ bulkId: 'bulk-uuid-456' }),
            bulkExport: jest.fn().mockResolvedValue({
              bulkId: 'bulk-uuid-789',
              downloadUrl: '/api/documents/bulk/bulk-uuid-789/download',
            }),
            getBulkProgress: jest.fn().mockReturnValue({
              total: 5,
              completed: 3,
              failed: 0,
              done: false,
            }),
            getBulkDownload: jest.fn().mockReturnValue({
              filename: 'export.csv',
              mimeType: 'text/csv',
              buffer: Buffer.from('test'),
            }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(DocumentController);
    documentService = module.get(DocumentService);
  });

  // 2A.1 — POST /documents/bulk/cancel — permission + Idempotency-Key + response 202 + bulkId
  describe('2A.1 — bulkCancel', () => {
    it('ส่ง Idempotency-Key + valid DTO → 202 + bulkId', async () => {
      const dto: BulkCancelRequestDto = {
        publicIds: ['019505a1-7c3e-7000-8000-abc123def456'],
        documentType: 'CORRESPONDENCE',
        reason: 'test',
      };

      const result = await controller.bulkCancel(dto, mockUser, 'idem-key-1');

      expect(result).toHaveProperty('bulkId');
      expect(documentService.bulkCancel).toHaveBeenCalledWith(
        dto.publicIds,
        dto.documentType,
        dto.reason,
        mockUser
      );
    });

    it('ขาด Idempotency-Key → ValidationException', async () => {
      const dto: BulkCancelRequestDto = {
        publicIds: ['019505a1-7c3e-7000-8000-abc123def456'],
        documentType: 'CORRESPONDENCE',
      };

      await expect(
        controller.bulkCancel(dto, mockUser, undefined)
      ).rejects.toThrow(ValidationException);
      expect(documentService.bulkCancel).not.toHaveBeenCalled();
    });

    it('Idempotency-Key ว่าง → ValidationException', async () => {
      const dto: BulkCancelRequestDto = {
        publicIds: ['019505a1-7c3e-7000-8000-abc123def456'],
        documentType: 'CORRESPONDENCE',
      };

      await expect(controller.bulkCancel(dto, mockUser, '   ')).rejects.toThrow(
        ValidationException
      );
    });
  });

  // 2A.2 — POST /documents/bulk/tag — permission + cross-type + response 202
  describe('2A.2 — bulkTag', () => {
    it('ส่ง valid DTO + Idempotency-Key → 202 + bulkId', async () => {
      const dto: BulkTagRequestDto = {
        publicIds: ['019505a1-7c3e-7000-8000-abc123def456'],
        documentType: 'RFA',
        addTags: [1, 2],
        removeTags: [3],
      };

      const result = await controller.bulkTag(dto, mockUser, 'idem-key-2');

      expect(result).toHaveProperty('bulkId');
      expect(documentService.bulkTag).toHaveBeenCalledWith(
        dto.publicIds,
        dto.documentType,
        dto.addTags,
        dto.removeTags,
        mockUser
      );
    });

    it('ขาด Idempotency-Key → ValidationException', async () => {
      const dto: BulkTagRequestDto = {
        publicIds: ['019505a1-7c3e-7000-8000-abc123def456'],
        documentType: 'RFA',
        addTags: [1],
      };

      await expect(
        controller.bulkTag(dto, mockUser, undefined)
      ).rejects.toThrow(ValidationException);
    });
  });

  // 2A.3 — POST /documents/bulk/export — permission + response 202 + downloadUrl
  describe('2A.3 — bulkExport', () => {
    it('ส่ง valid DTO + Idempotency-Key → 202 + bulkId + downloadUrl', async () => {
      const dto: BulkExportRequestDto = {
        publicIds: ['019505a1-7c3e-7000-8000-abc123def456'],
        documentType: 'TRANSMITTAL',
        format: 'CSV' as never,
        columns: ['subject', 'status'],
      };

      const result = await controller.bulkExport(dto, mockUser, 'idem-key-3');

      expect(result).toHaveProperty('bulkId');
      expect(result).toHaveProperty('downloadUrl');
      expect(documentService.bulkExport).toHaveBeenCalledWith(
        dto.publicIds,
        dto.documentType,
        dto.format,
        dto.columns,
        mockUser
      );
    });

    it('ขาด Idempotency-Key → ValidationException', async () => {
      const dto: BulkExportRequestDto = {
        publicIds: ['019505a1-7c3e-7000-8000-abc123def456'],
        documentType: 'TRANSMITTAL',
        format: 'CSV' as never,
        columns: [],
      };

      await expect(
        controller.bulkExport(dto, mockUser, undefined)
      ).rejects.toThrow(ValidationException);
    });
  });

  // 2A.4 — max 100 items exceeded → validation error (DTO level — class-validator)
  describe('2A.4 — ArrayMaxSize(100) validation', () => {
    it('DTO publicIds เกิน 100 → มี arrayMaxSize error', async () => {
      const dto = new BulkCancelRequestDto();
      dto.publicIds = Array.from(
        { length: 101 },
        () => '019505a1-7c3e-7000-8000-abc123def456'
      );
      dto.documentType = 'CORRESPONDENCE';

      const errors = await validate(dto);
      const publicIdsErrors = errors.filter((e) => e.property === 'publicIds');
      expect(publicIdsErrors.length).toBeGreaterThan(0);
      const constraints = publicIdsErrors[0]?.constraints ?? {};
      expect(Object.keys(constraints)).toContain('arrayMaxSize');
    });
  });

  // 2A.6 — ตรวจ response ใช้ publicId (UUIDv7) ไม่ใช่ INT id
  describe('2A.6 — ADR-019 UUID compliance', () => {
    it('bulkCancel response มี bulkId เป็น string (ไม่ใช่ INT)', async () => {
      const dto: BulkCancelRequestDto = {
        publicIds: ['019505a1-7c3e-7000-8000-abc123def456'],
        documentType: 'CORRESPONDENCE',
      };

      const result = await controller.bulkCancel(dto, mockUser, 'idem-key-6');

      expect(typeof result.bulkId).toBe('string');
    });

    it('DTO publicIds ไม่ใช่ UUID → มี isUuid error', async () => {
      const dto = new BulkCancelRequestDto();
      dto.publicIds = ['not-a-uuid'];
      dto.documentType = 'CORRESPONDENCE';

      const errors = await validate(dto);
      const publicIdsErrors = errors.filter((e) => e.property === 'publicIds');
      expect(publicIdsErrors.length).toBeGreaterThan(0);
      const constraints = publicIdsErrors[0]?.constraints ?? {};
      expect(Object.keys(constraints)).toContain('isUuid');
    });
  });
});
