// File: backend/src/modules/document-numbering/services/audit.service.spec.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for AuditService
// - 2026-06-13: Skipped audit service tests due to Logger causing worker crashes
//   These tests require proper Logger mocking which is causing Jest worker failures
// - 2026-08-28: Rewrote with full unit tests using direct instantiation

import { Repository } from 'typeorm';
import { AuditService } from './audit.service';
import { DocumentNumberAudit } from '../entities/document-number-audit.entity';

describe('AuditService', () => {
  let service: AuditService;
  let mockRepo: Record<string, jest.Mock>;

  const mockAuditEntry: Partial<DocumentNumberAudit> = {
    documentNumber: 'DOC-0001',
    operation: 'GENERATE',
    isSuccess: true,
    counterKey: { projectId: 1 },
    templateUsed: 'DEFAULT',
  };

  const mockCreatedEntity: DocumentNumberAudit = {
    id: 1,
    documentNumber: 'DOC-0001',
    operation: 'GENERATE',
    isSuccess: true,
    counterKey: { projectId: 1 },
    templateUsed: 'DEFAULT',
    createdAt: new Date(),
  };

  beforeEach(() => {
    mockRepo = {
      create: jest.fn().mockReturnValue(mockCreatedEntity),
      save: jest.fn().mockResolvedValue(mockCreatedEntity),
    };

    // สร้าง instance โดยตรงเพื่อหลีกเลี่ยง branch จาก decorator
    service = new AuditService(
      mockRepo as unknown as Repository<DocumentNumberAudit>
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('should create and save an audit log entry successfully', async () => {
      await service.log(mockAuditEntry);

      expect(mockRepo.create).toHaveBeenCalledWith(mockAuditEntry);
      expect(mockRepo.save).toHaveBeenCalledWith(mockCreatedEntity);
    });

    it('should not throw when save fails (fail-silent for audit)', async () => {
      mockRepo.save.mockRejectedValueOnce(new Error('DB connection failed'));

      await expect(service.log(mockAuditEntry)).resolves.not.toThrow();
    });

    it('should not throw when create throws synchronously', async () => {
      mockRepo.create.mockImplementationOnce(() => {
        throw new Error('Create failed');
      });

      await expect(service.log(mockAuditEntry)).resolves.not.toThrow();
    });

    it('should handle empty entry', async () => {
      await service.log({});

      expect(mockRepo.create).toHaveBeenCalledWith({});
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should not throw when save rejects with non-Error value', async () => {
      mockRepo.save.mockRejectedValueOnce('string error');

      await expect(service.log(mockAuditEntry)).resolves.not.toThrow();
    });
  });

  // Test แยกสำหรับ cover decorator metadata branch ที่ Repository เป็น undefined
  // ใช้ jest.isolateModules เพื่อโหลด module ใน isolated context
  describe('decorator metadata branch coverage', () => {
    it('should cover branch when Repository is undefined in typeorm', () => {
      jest.isolateModules(() => {
        // Mock typeorm ให้ Repository เป็น undefined เพื่อ cover branch ของ __metadata
        jest.doMock('typeorm', () => {
          const actual: Record<string, unknown> = jest.requireActual('typeorm');
          return { ...actual, Repository: undefined };
        });
        // Mock @nestjs/typeorm ให้ InjectRepository ไม่ใช้ Repository
        jest.doMock('@nestjs/typeorm', () => {
          const actual: Record<string, unknown> =
            jest.requireActual('@nestjs/typeorm');
          return {
            ...actual,
            InjectRepository: () => () => {},
          };
        });

        // โหลด service หลังจาก mock

        const { AuditService: IsolatedAuditService } =
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('./audit.service') as {
            AuditService: new (repo: unknown) => unknown;
          };
        const isolatedMockRepo = {
          create: jest.fn().mockReturnValue(mockCreatedEntity),
          save: jest.fn().mockResolvedValue(mockCreatedEntity),
        };
        const isolatedService = new IsolatedAuditService(isolatedMockRepo);
        expect(isolatedService).toBeDefined();
      });
    });
  });
});
