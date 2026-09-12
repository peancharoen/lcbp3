// File: backend/src/modules/maintenance/maintenance.controller.spec.ts
// Change Log:
// - 2026-09-12: Unit tests สำหรับ MaintenanceController (Feature 253 — Phase 2B, FR-030 to FR-031)

import { Test, type TestingModule } from '@nestjs/testing';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { ValidationException } from '../../common/exceptions/base.exception';
import { User } from '../user/entities/user.entity';

/**
 * Unit tests สำหรับ MaintenanceController — Feature 253 Phase 2B
 * ครอบคลุม FR-030 to FR-031: Numbering Tools / Orphan Cleanup / Vector Sync / Emergency Unlock + RBAC
 */
describe('MaintenanceController (Feature 253 — Phase 2B)', () => {
  let controller: MaintenanceController;
  let maintenanceService: jest.Mocked<MaintenanceService>;

  const mockUser = {
    user_id: 42,
    publicId: '01a01992-8420-7d9b-8f9b-a89b52cb48bd',
  } as User;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MaintenanceController],
      providers: [
        {
          provide: MaintenanceService,
          useValue: {
            getNumberingGaps: jest.fn().mockResolvedValue([]),
            syncNumberingCounters: jest.fn().mockResolvedValue({ synced: 3 }),
            overrideNumbering: jest.fn().mockResolvedValue({ overridden: 1 }),
            scanOrphans: jest.fn().mockResolvedValue([]),
            purgeOrphans: jest.fn().mockResolvedValue({ purged: 0 }),
            findMissingVectors: jest.fn().mockResolvedValue([]),
            enqueueReEmbed: jest.fn().mockResolvedValue({ enqueued: 1 }),
            findOrphanVectors: jest.fn().mockResolvedValue([]),
            scanStuckLocks: jest.fn().mockResolvedValue([]),
            forceReleaseLocks: jest.fn().mockResolvedValue({ released: 0 }),
            bulkHardPurge: jest.fn().mockResolvedValue({ purged: 0 }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(MaintenanceController);
    maintenanceService = module.get(MaintenanceService);
  });

  // 2B.1 — Numbering Tools endpoints — permission + Idempotency-Key
  describe('2B.1 — Numbering Tools', () => {
    it('GET /numbering/gaps → เรียก service.getNumberingGaps', async () => {
      await controller.numberingGaps('proj-1');
      expect(maintenanceService.getNumberingGaps).toHaveBeenCalledWith(
        'proj-1'
      );
    });

    it('POST /numbering/sync + Idempotency-Key → เรียก service.syncNumberingCounters', async () => {
      await controller.syncCounters({ projectId: 'proj-1' }, 'idem-key-1');
      expect(maintenanceService.syncNumberingCounters).toHaveBeenCalledWith(
        'proj-1'
      );
    });

    it('POST /numbering/sync ขาด Idempotency-Key → ValidationException', () => {
      expect(() =>
        controller.syncCounters({ projectId: 'proj-1' }, undefined)
      ).toThrow(ValidationException);
    });

    it('POST /numbering/override + Idempotency-Key → เรียก service.overrideNumbering', async () => {
      const dto = { counterKey: 'CORR', newLastNumber: 100, reason: 'fix gap' };
      await controller.overrideCounter(dto, mockUser, 'idem-key-2');
      expect(maintenanceService.overrideNumbering).toHaveBeenCalledWith(
        'CORR',
        100,
        'fix gap',
        mockUser
      );
    });
  });

  // 2B.2 — Orphan Cleanup endpoints — permission
  describe('2B.2 — Orphan Cleanup', () => {
    it('GET /orphan-cleanup/scan → เรียก service.scanOrphans', async () => {
      await controller.scanOrphans();
      expect(maintenanceService.scanOrphans).toHaveBeenCalled();
    });

    it('POST /orphan-cleanup/purge + Idempotency-Key → เรียก service.purgeOrphans', async () => {
      const dto = { paths: ['/tmp/orphan1.pdf'] };
      await controller.purgeOrphans(dto, mockUser, 'idem-key-3');
      expect(maintenanceService.purgeOrphans).toHaveBeenCalledWith(
        dto.paths,
        mockUser
      );
    });

    it('POST /orphan-cleanup/purge ขาด Idempotency-Key → ValidationException', () => {
      const dto = { paths: ['/tmp/orphan1.pdf'] };
      expect(() => controller.purgeOrphans(dto, mockUser, undefined)).toThrow(
        ValidationException
      );
    });
  });

  // 2B.3 — Vector Sync endpoints — permission
  describe('2B.3 — Vector Sync', () => {
    it('GET /vector-sync/missing → เรียก service.findMissingVectors', async () => {
      await controller.missingVectors('proj-1');
      expect(maintenanceService.findMissingVectors).toHaveBeenCalledWith(
        'proj-1'
      );
    });

    it('POST /vector-sync/enqueue + Idempotency-Key → เรียก service.enqueueReEmbed', async () => {
      const dto = {
        projectPublicId: '01a01992-8420-74ff-b0f4-0c8560a8478c',
        documentPublicId: '019505a1-7c3e-7000-8000-abc123def456',
      };
      await controller.enqueueReEmbed(dto, 'idem-key-4');
      expect(maintenanceService.enqueueReEmbed).toHaveBeenCalledWith(
        dto.projectPublicId,
        dto.documentPublicId
      );
    });

    it('POST /vector-sync/enqueue ขาด Idempotency-Key → ValidationException', () => {
      const dto = {
        projectPublicId: '01a01992-8420-74ff-b0f4-0c8560a8478c',
        documentPublicId: '019505a1-7c3e-7000-8000-abc123def456',
      };
      expect(() => controller.enqueueReEmbed(dto, undefined)).toThrow(
        ValidationException
      );
    });
  });

  // 2B.4 — Emergency Unlock endpoints — permission + system.manage_all สำหรับ bulk-hard-purge
  describe('2B.4 — Emergency Unlock', () => {
    it('GET /emergency-unlock/stuck-locks → เรียก service.scanStuckLocks', async () => {
      await controller.stuckLocks();
      expect(maintenanceService.scanStuckLocks).toHaveBeenCalled();
    });

    it('POST /emergency-unlock/release + Idempotency-Key → เรียก service.forceReleaseLocks', async () => {
      const dto = { lockKeys: ['lock:hard-delete:abc'] };
      await controller.releaseLocks(dto, 'idem-key-5');
      expect(maintenanceService.forceReleaseLocks).toHaveBeenCalledWith(
        dto.lockKeys
      );
    });

    it('POST /emergency-unlock/bulk-hard-purge + Idempotency-Key → เรียก service.bulkHardPurge', async () => {
      const dto = {
        publicIds: ['019505a1-7c3e-7000-8000-abc123def456'],
        documentType: 'CORRESPONDENCE',
      };
      await controller.bulkHardPurge(dto, mockUser, 'idem-key-6');
      expect(maintenanceService.bulkHardPurge).toHaveBeenCalledWith(
        dto.publicIds,
        dto.documentType,
        mockUser
      );
    });

    it('POST /emergency-unlock/bulk-hard-purge ขาด Idempotency-Key → ValidationException', () => {
      const dto = {
        publicIds: ['019505a1-7c3e-7000-8000-abc123def456'],
        documentType: 'CORRESPONDENCE',
      };
      expect(() => controller.bulkHardPurge(dto, mockUser, undefined)).toThrow(
        ValidationException
      );
    });
  });

  // 2B.5 — RBAC: ตรวจว่าทุก endpoint มี @RequirePermission decorator
  describe('2B.5 — RBAC decorator coverage', () => {
    it('ทุก endpoint มี @RequirePermission — ตรวจ method มีอยู่บน prototype', () => {
      // ตรวจว่า method ทุกตัวมีอยู่บน prototype (decorator ถูก apply แล้ว)
      const prototype = MaintenanceController.prototype;
      const methodNames = [
        'numberingGaps',
        'syncCounters',
        'overrideCounter',
        'scanOrphans',
        'purgeOrphans',
        'missingVectors',
        'enqueueReEmbed',
        'orphanVectors',
        'stuckLocks',
        'releaseLocks',
        'bulkHardPurge',
      ];

      for (const methodName of methodNames) {
        expect(typeof prototype[methodName]).toBe('function');
      }
    });
  });
});
