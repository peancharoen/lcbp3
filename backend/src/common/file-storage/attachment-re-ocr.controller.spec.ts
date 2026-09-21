// File: backend/src/common/file-storage/attachment-re-ocr.controller.spec.ts
// Change Log
// - 2026-09-19: ADR-055 T015 — contract ของ 3 endpoints (RBAC/audit/throttle metadata, Idempotency-Key, DTO validation)
// - 2026-09-19: review fix — เพิ่ม preview endpoint (rag.manage) + FileStorageService dependency
// - 2026-09-19: ADR-055 extension (D19) — POST re-ocr/replace (dual permission) + GET re-ocr/links

import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AttachmentReOcrController } from './attachment-re-ocr.controller';
import { AttachmentReOcrService } from './attachment-re-ocr.service';
import { FileStorageService } from './file-storage.service';
import {
  ConfirmReOcrDto,
  TriggerReOcrDto,
  TriggerReplaceFileDto,
} from './dto/re-ocr.dto';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { AUDIT_KEY } from '../decorators/audit.decorator';
import { AiEnabledGuard } from '../../modules/ai/guards/ai-enabled.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RbacGuard } from '../guards/rbac.guard';
import type { RequestWithUser } from '../interfaces/request-with-user.interface';

const ATT = '019a0000-0000-7000-8000-000000000001';
const TOKEN = '019a0000-0000-7000-8000-0000000000aa';
const req = {
  user: { username: 'admin', firstName: 'Ada', lastName: 'Min', user_id: 7 },
} as unknown as RequestWithUser;

describe('AttachmentReOcrController (ADR-055 D11)', () => {
  const service = {
    trigger: jest.fn().mockResolvedValue({ reOcrToken: TOKEN }),
    triggerReplace: jest.fn().mockResolvedValue({ reOcrToken: TOKEN }),
    listLinks: jest.fn().mockResolvedValue([]),
    getStatus: jest.fn().mockResolvedValue({ status: 'queued' }),
    confirm: jest.fn().mockResolvedValue({ status: 'confirmed' }),
  };
  const fileStorage = {
    preview: jest.fn().mockResolvedValue({
      stream: {},
      attachment: {
        originalFilename: 'a.pdf',
        mimeType: 'application/pdf',
        fileSize: 10,
      },
    }),
  };
  const controller = new AttachmentReOcrController(
    service as unknown as AttachmentReOcrService,
    fileStorage as unknown as FileStorageService
  );
  const proto = AttachmentReOcrController.prototype;

  beforeEach(() => jest.clearAllMocks());

  it('class-level guards = JwtAuthGuard + RbacGuard', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AttachmentReOcrController
    ) as unknown[];
    expect(guards).toEqual([JwtAuthGuard, RbacGuard]);
  });

  it.each([
    ['trigger', ['rag.admin.write'], 'attachment.re_ocr.trigger', true],
    ['confirm', ['rag.admin.write'], 'attachment.re_ocr.confirm', true],
    [
      'triggerReplace',
      ['rag.admin.write', 'correspondence.edit'],
      'attachment.re_ocr.replace',
      true,
    ],
    ['links', ['rag.admin.write', 'correspondence.edit'], undefined, false],
    ['status', ['rag.manage'], undefined, false],
  ] as const)(
    '%s: permission=%s, audit=%s, AiEnabledGuard=%s',
    (method, permissions, audit, aiGuard) => {
      const handler = proto[method] as unknown as object;
      expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([
        ...permissions,
      ]);
      expect(
        (Reflect.getMetadata(AUDIT_KEY, handler) as { action?: string })?.action
      ).toBe(audit);
      const guards = (Reflect.getMetadata(GUARDS_METADATA, handler) ??
        []) as unknown[];
      expect(guards.includes(AiEnabledGuard)).toBe(aiGuard);
    }
  );

  it('trigger + confirm มี @Throttle metadata', () => {
    for (const method of ['trigger', 'confirm'] as const) {
      const keys = Reflect.getMetadataKeys(proto[method] as unknown as object);
      expect(keys.some((k: string) => /THROTTLER/i.test(k))).toBe(true);
    }
  });

  it('trigger: ไม่มี Idempotency-Key → 400 และไม่เรียก service', async () => {
    await expect(
      controller.trigger(ATT, {}, undefined, req)
    ).rejects.toMatchObject({ status: 400 });
    expect(service.trigger).not.toHaveBeenCalled();
  });

  it("trigger: default engineType='np-dms-ocr' + displayName จาก user", async () => {
    await controller.trigger(ATT, {}, 'idem-1', req);
    expect(service.trigger).toHaveBeenCalledWith(ATT, 'np-dms-ocr', {
      displayName: 'Ada Min',
    });
    await controller.trigger(ATT, { engineType: 'auto' }, 'idem-2', req);
    expect(service.trigger).toHaveBeenLastCalledWith(ATT, 'auto', {
      displayName: 'Ada Min',
    });
  });

  it('confirm: ไม่มี/ว่าง Idempotency-Key → 400; มี → เรียก service พร้อม actor', async () => {
    await expect(
      controller.confirm(ATT, { reOcrToken: TOKEN }, '  ', req)
    ).rejects.toMatchObject({ status: 400 });
    await controller.confirm(ATT, { reOcrToken: TOKEN }, 'idem-3', req);
    expect(service.confirm).toHaveBeenCalledWith(ATT, TOKEN, {
      displayName: 'Ada Min',
      userId: 7,
    });
  });

  it('triggerReplace: ไม่มี Idempotency-Key → 400 และไม่เรียก service', async () => {
    await expect(
      controller.triggerReplace(
        ATT,
        { targetCorrespondencePublicId: 'x' } as TriggerReplaceFileDto,
        undefined,
        req
      )
    ).rejects.toMatchObject({ status: 400 });
    expect(service.triggerReplace).not.toHaveBeenCalled();
  });

  it('triggerReplace: ส่ง dto + actor (displayName + userId) ให้ service', async () => {
    const dto = {
      engineType: 'auto',
      targetCorrespondencePublicId: '019a0000-0000-7000-8000-0000000000bb',
      tempAttachmentPublicId: '019a0000-0000-7000-8000-0000000000cc',
    } as TriggerReplaceFileDto;
    await controller.triggerReplace(ATT, dto, 'idem-9', req);
    expect(service.triggerReplace).toHaveBeenCalledWith(
      ATT,
      {
        engineType: 'auto',
        targetCorrespondencePublicId: dto.targetCorrespondencePublicId,
        storageTempPath: undefined,
        tempAttachmentPublicId: dto.tempAttachmentPublicId,
      },
      { displayName: 'Ada Min', userId: 7 }
    );
  });

  it('links: delegate ไป service.listLinks', async () => {
    await controller.links(ATT);
    expect(service.listLinks).toHaveBeenCalledWith(ATT);
  });

  it('status: delegate ไป service.getStatus', async () => {
    await controller.status(ATT);
    expect(service.getStatus).toHaveBeenCalledWith(ATT);
  });

  it('preview: ต้องการ rag.manage และ delegate ไป fileStorageService.preview', async () => {
    const handler = proto.preview as unknown as object;
    expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([
      'rag.manage',
    ]);
    const res = { set: jest.fn() };
    const out = await controller.preview(
      ATT,
      res as unknown as Parameters<typeof controller.preview>[1]
    );
    expect(fileStorage.preview).toHaveBeenCalledWith(ATT);
    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Type': 'application/pdf',
      })
    );
    expect(out).toBeDefined();
  });

  describe('DTO validation', () => {
    it('engineType นอก {np-dms-ocr, auto} → error', async () => {
      const bad = plainToInstance(TriggerReOcrDto, { engineType: 'gpt' });
      expect((await validate(bad)).length).toBeGreaterThan(0);
      const ok = plainToInstance(TriggerReOcrDto, { engineType: 'auto' });
      expect(await validate(ok)).toHaveLength(0);
      expect(await validate(plainToInstance(TriggerReOcrDto, {}))).toHaveLength(
        0
      );
    });
    it('confirm: reOcrToken ต้องเป็น UUID', async () => {
      expect(
        (await validate(plainToInstance(ConfirmReOcrDto, { reOcrToken: 'x' })))
          .length
      ).toBeGreaterThan(0);
      expect(
        await validate(plainToInstance(ConfirmReOcrDto, { reOcrToken: TOKEN }))
      ).toHaveLength(0);
    });
    it('TriggerReplaceFileDto: targetCorrespondencePublicId ต้องเป็น UUID; tempAttachmentPublicId เป็น UUID เมื่อมี', async () => {
      const bad = plainToInstance(TriggerReplaceFileDto, {
        targetCorrespondencePublicId: 'not-uuid',
      });
      expect((await validate(bad)).length).toBeGreaterThan(0);
      const badTemp = plainToInstance(TriggerReplaceFileDto, {
        targetCorrespondencePublicId: TOKEN,
        tempAttachmentPublicId: 'nope',
      });
      expect((await validate(badTemp)).length).toBeGreaterThan(0);
      const ok = plainToInstance(TriggerReplaceFileDto, {
        targetCorrespondencePublicId: TOKEN,
        storageTempPath: '/staging/x.pdf',
      });
      expect(await validate(ok)).toHaveLength(0);
    });
  });
});
