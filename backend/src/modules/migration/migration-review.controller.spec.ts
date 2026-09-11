// File: backend/src/modules/migration/migration-review.controller.spec.ts
// Change Log:
// - 2026-09-11: สร้าง Unit Test สำหรับ MigrationReviewController (Phase 2D — branch coverage 0%→80%)

import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { UnauthorizedException } from '@nestjs/common';
import { MigrationReviewController } from './migration-review.controller';
import { MigrationReviewService } from './migration-review.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/auth/guards/permissions.guard';
import { ValidationException } from '../../common/exceptions';
import { User } from '../user/entities/user.entity';

describe('MigrationReviewController (Phase 2D)', () => {
  let controller: MigrationReviewController;
  let reviewService: { commitRecord: jest.Mock };

  beforeEach(async () => {
    const mockReviewService = {
      commitRecord: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MigrationReviewController],
      providers: [
        Reflector,
        { provide: MigrationReviewService, useValue: mockReviewService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<MigrationReviewController>(
      MigrationReviewController
    );
    reviewService = module.get(MigrationReviewService);
  });

  const mockUser = { user_id: 42 } as User;
  const validDto = {
    queuePublicId: '019505a1-7c3e-7000-8000-queue001',
    ocrText: 'sample OCR text',
    metadata: { docNumber: 'DOC-001' },
    tagDecisions: [],
  };

  it('ควรเรียก reviewService.commitRecord เมื่อ Idempotency-Key และ user ครบ', async () => {
    const result = await controller.commitRecord(
      validDto,
      'idem-key-001',
      mockUser
    );

    expect(reviewService.commitRecord).toHaveBeenCalledWith(
      validDto,
      42,
      'idem-key-001'
    );
    expect(result).toEqual({ success: true });
  });

  it('ควร throw ValidationException เมื่อไม่มี Idempotency-Key header', async () => {
    await expect(
      controller.commitRecord(validDto, undefined, mockUser)
    ).rejects.toThrow(ValidationException);

    expect(reviewService.commitRecord).not.toHaveBeenCalled();
  });

  it('ควร throw ValidationException เมื่อ Idempotency-Key เป็น empty string', async () => {
    await expect(
      controller.commitRecord(validDto, '', mockUser)
    ).rejects.toThrow(ValidationException);

    expect(reviewService.commitRecord).not.toHaveBeenCalled();
  });

  it('ควร throw UnauthorizedException เมื่อ user ไม่มี user_id', async () => {
    const noIdUser = {} as User;

    await expect(
      controller.commitRecord(validDto, 'idem-key-002', noIdUser)
    ).rejects.toThrow(UnauthorizedException);

    expect(reviewService.commitRecord).not.toHaveBeenCalled();
  });

  it('ควร throw UnauthorizedException เมื่อ user เป็น null/undefined', async () => {
    await expect(
      controller.commitRecord(
        validDto,
        'idem-key-003',
        undefined as unknown as User
      )
    ).rejects.toThrow(UnauthorizedException);

    expect(reviewService.commitRecord).not.toHaveBeenCalled();
  });
});
