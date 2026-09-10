// File: backend/src/modules/ai/services/rag-classification.service.spec.ts
// Change Log:
// - 2026-09-12: T064+T065 RED tests สำหรับ RagClassificationService (CASL + audit, Feature 254 Phase 7 US5)
//
// หมายเหตุ: RagClassificationService ยังไม่มีอยู่จริง — เป็น RED test ตาม TDD
// GREEN implementation ถูก defer ไปยัง T068

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbilityFactory } from '../../../common/auth/casl/ability.factory';
import { Attachment } from '../../../common/file-storage/entities/attachment.entity';
import { AuditLog } from '../../../common/entities/audit-log.entity';
import { User } from '../../user/entities/user.entity';
import { RagClassificationService } from './rag-classification.service';

/**
 * Factory สร้าง mock User สำหรับ CASL ability check
 * @param userId - internal INT id
 * @param userPublicId - UUIDv7 publicId
 */
const createMockUser = (userId: number, userPublicId: string): User =>
  ({
    user_id: userId,
    publicId: userPublicId,
    username: 'override-user',
    assignments: [],
  }) as unknown as User;

describe('RagClassificationService', () => {
  let service: RagClassificationService;
  let attachmentRepository: jest.Mocked<
    Pick<Repository<Attachment>, 'findOne' | 'update'>
  >;
  let auditLogRepository: jest.Mocked<
    Pick<Repository<AuditLog>, 'create' | 'save'>
  >;
  let abilityFactory: { createForUser: jest.Mock };
  let mockAbility: { can: jest.Mock };

  beforeEach(async () => {
    attachmentRepository = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };
    auditLogRepository = {
      create: jest.fn((value: unknown) => value),
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockAbility = { can: jest.fn().mockReturnValue(false) };
    abilityFactory = { createForUser: jest.fn().mockReturnValue(mockAbility) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagClassificationService,
        {
          provide: getRepositoryToken(Attachment),
          useValue: attachmentRepository,
        },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: auditLogRepository,
        },
        { provide: AbilityFactory, useValue: abilityFactory },
      ],
    }).compile();

    service = module.get<RagClassificationService>(RagClassificationService);
  });

  // ค่า default สำหรับการเรียก overrideClassification
  const attachmentPublicId = '0195a1b2-c3d4-7000-8000-abc123def456';
  const actor = createMockUser(42, '0195c1d2-e3f4-7000-8000-abc123def456');
  const reason = 'Reclassify per security review 2026-09-12';

  // ==========================================================
  // T064 — CASL permission checks for document.classification_override
  // สิทธิ์ id=238 — Superadmin-only (role_id=1) หรือผู้ได้รับมอบสิทธิ์
  // ==========================================================
  describe('T064 — CASL permission checks', () => {
    it('throws ForbiddenException when user lacks document.classification_override permission', async () => {
      // user ไม่มีสิทธิ์ classification_override → ability.can() false
      mockAbility.can.mockReturnValue(false);

      await expect(
        service.overrideClassification({
          attachmentPublicId,
          newClassification: 'CONFIDENTIAL',
          reason,
          user: actor,
        })
      ).rejects.toThrow(ForbiddenException);

      // ต้องไม่อัปเดต Attachment เมื่อไม่มีสิทธิ์
      expect(attachmentRepository.update).not.toHaveBeenCalled();
    });

    it('succeeds when user has document.classification_override permission', async () => {
      // user มีสิทธิ์ classification_override → ability.can() true
      mockAbility.can.mockReturnValue(true);
      attachmentRepository.findOne.mockResolvedValue({
        publicId: attachmentPublicId,
        classification: 'INTERNAL',
      } as Attachment);

      await expect(
        service.overrideClassification({
          attachmentPublicId,
          newClassification: 'CONFIDENTIAL',
          reason,
          user: actor,
        })
      ).resolves.toBeUndefined();

      // ต้องอัปเดต Attachment classification ใหม่
      expect(attachmentRepository.update).toHaveBeenCalledWith(
        { publicId: attachmentPublicId },
        expect.objectContaining({ classification: 'CONFIDENTIAL' })
      );
    });

    it('succeeds when user has system.manage_all (Superadmin)', async () => {
      // Superadmin ผ่าน system.manage_all → ability.can('manage','all') true
      mockAbility.can.mockReturnValue(true);
      attachmentRepository.findOne.mockResolvedValue({
        publicId: attachmentPublicId,
        classification: 'PUBLIC',
      } as Attachment);

      const superadmin = createMockUser(
        1,
        '0195s1p2-e3f4-7000-8000-abc123def456'
      );

      await expect(
        service.overrideClassification({
          attachmentPublicId,
          newClassification: 'INTERNAL',
          reason,
          user: superadmin,
        })
      ).resolves.toBeUndefined();

      expect(attachmentRepository.update).toHaveBeenCalledWith(
        { publicId: attachmentPublicId },
        expect.objectContaining({ classification: 'INTERNAL' })
      );
    });

    it('throws ForbiddenException when user has neither permission', async () => {
      // user ไม่มีทั้ง classification_override และ system.manage_all
      mockAbility.can.mockReturnValue(false);

      const regularUser = createMockUser(
        7,
        '0195r1g2-e3f4-7000-8000-abc123def456'
      );

      await expect(
        service.overrideClassification({
          attachmentPublicId,
          newClassification: 'CONFIDENTIAL',
          reason,
          user: regularUser,
        })
      ).rejects.toThrow(ForbiddenException);

      expect(attachmentRepository.update).not.toHaveBeenCalled();
      // ต้องไม่เขียน audit log เมื่อถูกปฏิเสธ
      expect(auditLogRepository.save).not.toHaveBeenCalled();
    });
  });

  // ==========================================================
  // T065 — Audit trail (before/after/reason/actor)
  // บันทึก audit log ลงตาราง audit_logs ตาม ADR-016
  // ==========================================================
  describe('T065 — Audit trail', () => {
    beforeEach(() => {
      // ให้สิทธิ์ผ่านก่อน เพื่อให้ถึงขั้นตอนบันทึก audit
      mockAbility.can.mockReturnValue(true);
    });

    it('records before-classification value in audit log', async () => {
      attachmentRepository.findOne.mockResolvedValue({
        publicId: attachmentPublicId,
        classification: 'INTERNAL',
      } as Attachment);

      await service.overrideClassification({
        attachmentPublicId,
        newClassification: 'CONFIDENTIAL',
        reason,
        user: actor,
      });

      // audit log ต้องบันทึกค่า classification เดิม (before)
      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          detailsJson: expect.objectContaining({
            beforeClassification: 'INTERNAL',
          }),
        })
      );
      expect(auditLogRepository.save).toHaveBeenCalled();
    });

    it('records after-classification value in audit log', async () => {
      attachmentRepository.findOne.mockResolvedValue({
        publicId: attachmentPublicId,
        classification: 'PUBLIC',
      } as Attachment);

      await service.overrideClassification({
        attachmentPublicId,
        newClassification: 'CONFIDENTIAL',
        reason,
        user: actor,
      });

      // audit log ต้องบันทึกค่า classification ใหม่ (after)
      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          detailsJson: expect.objectContaining({
            afterClassification: 'CONFIDENTIAL',
          }),
        })
      );
    });

    it('records reason string in audit log', async () => {
      attachmentRepository.findOne.mockResolvedValue({
        publicId: attachmentPublicId,
        classification: 'PUBLIC',
      } as Attachment);

      await service.overrideClassification({
        attachmentPublicId,
        newClassification: 'INTERNAL',
        reason,
        user: actor,
      });

      // audit log ต้องบันทึกเหตุผลการเปลี่ยน classification
      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          detailsJson: expect.objectContaining({
            reason,
          }),
        })
      );
    });

    it('records actor userId and publicId in audit log', async () => {
      attachmentRepository.findOne.mockResolvedValue({
        publicId: attachmentPublicId,
        classification: 'PUBLIC',
      } as Attachment);

      await service.overrideClassification({
        attachmentPublicId,
        newClassification: 'CONFIDENTIAL',
        reason,
        user: actor,
      });

      // audit log ต้องบันทึก actor ทั้ง internal userId และ publicId
      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 42,
          detailsJson: expect.objectContaining({
            actorUserPublicId: '0195c1d2-e3f4-7000-8000-abc123def456',
          }),
        })
      );
    });

    it('writes to audit log table', async () => {
      attachmentRepository.findOne.mockResolvedValue({
        publicId: attachmentPublicId,
        classification: 'INTERNAL',
      } as Attachment);

      await service.overrideClassification({
        attachmentPublicId,
        newClassification: 'CONFIDENTIAL',
        reason,
        user: actor,
      });

      // ต้องมีการ create + save ลง audit_logs table จริง
      expect(auditLogRepository.create).toHaveBeenCalledTimes(1);
      expect(auditLogRepository.save).toHaveBeenCalledTimes(1);
      expect(auditLogRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'rag.attachment.classification_override',
        })
      );
    });
  });
});
