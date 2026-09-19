// File: backend/src/common/file-storage/attachment-re-ocr.service.spec.ts
// Change Log
// - 2026-09-19: ADR-055 T011–T013 — trigger / status / confirm ของ AttachmentReOcrService
// - 2026-09-19: review fix — trigger mutex (SET NX), confirm supersede/identical guards

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { access } from 'fs/promises';
import { Attachment } from './entities/attachment.entity';
import { AttachmentReOcrService } from './attachment-re-ocr.service';
import { AiQueueService } from '../../modules/ai/ai-queue.service';
import { RagAdminService } from '../../modules/ai/services/rag-admin.service';
import { QUEUE_NP_DMS_OCR } from '../../modules/common/constants/queue.constants';
import {
  reOcrPayloadKey,
  reOcrPointerKey,
  reOcrTriggerLockKey,
  RE_OCR_TTL_SECONDS,
} from './re-ocr.constants';

jest.mock('fs/promises', () => ({ access: jest.fn() }));

const ATT = '019a0000-0000-7000-8000-000000000001';
const TOKEN = '019a0000-0000-7000-8000-0000000000aa';
const USER = { displayName: 'Admin A' };
const REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

describe('AttachmentReOcrService (ADR-055)', () => {
  let service: AttachmentReOcrService;
  const store = new Map<string, string>();
  const redis = {
    get: jest.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
    set: jest.fn((k: string, v: string, ...args: unknown[]) => {
      // จำลอง SET ... NX — คืน null ถ้า key มีอยู่แล้ว (ตามพฤติกรรม Redis จริง)
      if (args.includes('NX') && store.has(k)) {
        return Promise.resolve(null);
      }
      store.set(k, v);
      return Promise.resolve('OK');
    }),
    setex: jest.fn((k: string, _t: number, v: string) => {
      store.set(k, v);
      return Promise.resolve('OK');
    }),
    del: jest.fn((...keys: string[]) => {
      keys.forEach((k) => store.delete(k));
      return Promise.resolve(keys.length);
    }),
  };
  const txUpdate = jest.fn();
  const attachmentRepo = {
    findOne: jest.fn(),
    manager: {
      transaction: jest.fn(
        (cb: (m: { update: jest.Mock }) => Promise<unknown>) =>
          cb({ update: txUpdate })
      ),
    },
  };
  const ocrQueue = { getJob: jest.fn() };
  const aiQueue = { enqueueAttachmentReOcr: jest.fn() };
  const ragAdmin = { reingest: jest.fn() };
  const baseAttachment = {
    publicId: ATT,
    mimeType: 'application/pdf',
    filePath: '/files/a.pdf',
    aiProcessingStatus: 'DONE',
    ocrText: 'old text that is fairly long',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    store.clear();
    (access as jest.Mock).mockResolvedValue(undefined);
    attachmentRepo.findOne.mockResolvedValue({ ...baseAttachment });
    aiQueue.enqueueAttachmentReOcr.mockResolvedValue({
      jobId: 're-ocr-x',
      queuePosition: 2,
      estimatedWaitSeconds: 180,
    });
    ragAdmin.reingest.mockResolvedValue({ status: 'BUILDING' });
    txUpdate.mockResolvedValue({ affected: 1 });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentReOcrService,
        { provide: getRepositoryToken(Attachment), useValue: attachmentRepo },
        { provide: REDIS_TOKEN, useValue: redis },
        { provide: getQueueToken(QUEUE_NP_DMS_OCR), useValue: ocrQueue },
        { provide: AiQueueService, useValue: aiQueue },
        { provide: RagAdminService, useValue: ragAdmin },
      ],
    }).compile();
    service = module.get(AttachmentReOcrService);
  });

  const pointer = (): Record<string, unknown> =>
    JSON.parse(store.get(reOcrPointerKey(ATT)) ?? '{}') as Record<
      string,
      unknown
    >;
  const seedPointer = (patch: Record<string, unknown>): void => {
    store.set(
      reOcrPointerKey(ATT),
      JSON.stringify({
        status: 'completed',
        reOcrToken: TOKEN,
        jobId: 're-ocr-job',
        engineType: 'np-dms-ocr',
        triggeredByDisplayName: 'Admin A',
        triggeredAt: '2026-09-19T00:00:00.000Z',
        ...patch,
      })
    );
  };
  const seedPayload = (newText: string): void => {
    store.set(
      reOcrPayloadKey(ATT, TOKEN),
      JSON.stringify({
        newText,
        engineUsed: 'np-dms-ocr',
        charCount: newText.length,
        processingTimeMs: 1200,
        completedAt: '2026-09-19T00:05:00.000Z',
      })
    );
  };

  describe('trigger', () => {
    it('เขียน pointer queued (TTL 72h + triggeredBy) แล้ว enqueue โดยไม่แตะ ocr_text', async () => {
      const res = await service.trigger(ATT, 'np-dms-ocr', USER);
      expect(res).toMatchObject({
        status: 'queued',
        jobId: 're-ocr-x',
        queuePosition: 2,
        estimatedWaitSeconds: 180,
      });
      expect(res.reOcrToken).toEqual(expect.any(String));
      expect(pointer()).toMatchObject({
        status: 'queued',
        reOcrToken: res.reOcrToken,
        engineType: 'np-dms-ocr',
        triggeredByDisplayName: 'Admin A',
      });
      expect(redis.setex).toHaveBeenCalledWith(
        reOcrPointerKey(ATT),
        RE_OCR_TTL_SECONDS,
        expect.any(String)
      );
      expect(aiQueue.enqueueAttachmentReOcr).toHaveBeenCalledWith(
        expect.objectContaining({
          pdfPath: '/files/a.pdf',
          engineType: 'np-dms-ocr',
          attachmentPublicId: ATT,
          reOcrToken: res.reOcrToken,
          idempotencyKey: res.reOcrToken,
          forceRefresh: true,
        })
      );
      expect(txUpdate).not.toHaveBeenCalled();
    });

    it('non-PDF → 422; ไฟล์หาย → 410; attachment ไม่พบ → 404', async () => {
      attachmentRepo.findOne.mockResolvedValueOnce({
        ...baseAttachment,
        mimeType: 'application/zip',
      });
      await expect(service.trigger(ATT, 'auto', USER)).rejects.toMatchObject({
        status: 422,
      });
      (access as jest.Mock).mockRejectedValueOnce(new Error('ENOENT'));
      await expect(service.trigger(ATT, 'auto', USER)).rejects.toMatchObject({
        status: 410,
      });
      attachmentRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.trigger(ATT, 'auto', USER)).rejects.toMatchObject({
        status: 404,
      });
      expect(aiQueue.enqueueAttachmentReOcr).not.toHaveBeenCalled();
    });

    it.each([
      ['PROCESSING', 409],
      ['PENDING', 200],
      ['DONE', 200],
      ['FAILED', 200],
    ])('ai_processing_status=%s → %i', async (status, code) => {
      attachmentRepo.findOne.mockResolvedValueOnce({
        ...baseAttachment,
        aiProcessingStatus: status,
      });
      const p = service.trigger(ATT, 'np-dms-ocr', USER);
      if (code === 409) {
        await expect(p).rejects.toMatchObject({ status: 409 });
      } else {
        await expect(p).resolves.toBeDefined();
      }
    });

    it('trigger mutex: lock ถูกถืออยู่ → 409 ทันที ไม่แตะ pointer/queue', async () => {
      store.set(reOcrTriggerLockKey(ATT), 'other-token');
      await expect(service.trigger(ATT, 'auto', USER)).rejects.toMatchObject({
        status: 409,
      });
      expect(aiQueue.enqueueAttachmentReOcr).not.toHaveBeenCalled();
      expect(store.has(reOcrPointerKey(ATT))).toBe(false);
    });

    it('pointer มี jobId deterministic (re-ocr-{id}-{token}) ตั้งแต่ก่อน enqueue และปล่อย mutex หลังจบ', async () => {
      const res = await service.trigger(ATT, 'np-dms-ocr', USER);
      expect(pointer().jobId).toBe(`re-ocr-${ATT}-${res.reOcrToken}`);
      expect(store.has(reOcrTriggerLockKey(ATT))).toBe(false);
    });

    it('in-flight guard: pointer queued/processing + job ยังอยู่ใน queue → 409; job หาย (stale) → อนุญาต', async () => {
      seedPointer({ status: 'processing', jobId: 'j1' });
      ocrQueue.getJob.mockResolvedValueOnce({
        getState: jest.fn().mockResolvedValue('active'),
      });
      await expect(
        service.trigger(ATT, 'np-dms-ocr', USER)
      ).rejects.toMatchObject({ status: 409 });
      ocrQueue.getJob.mockResolvedValueOnce(undefined);
      await expect(
        service.trigger(ATT, 'np-dms-ocr', USER)
      ).resolves.toBeDefined();
    });

    it('trigger ใหม่หลังผลเก่า completed → pointer ถูก overwrite ด้วย token ใหม่ และ payload ของ token เก่ายัง confirm ได้แยกกัน (ไม่ปนกัน)', async () => {
      seedPointer({ status: 'completed' });
      seedPayload('old-token payload');
      const res = await service.trigger(ATT, 'auto', USER);
      expect(res.reOcrToken).not.toBe(TOKEN);
      expect(pointer()).toMatchObject({
        reOcrToken: res.reOcrToken,
        status: 'queued',
        engineType: 'auto',
      });
      expect(store.has(reOcrPayloadKey(ATT, TOKEN))).toBe(true);
      expect(store.has(reOcrPayloadKey(ATT, res.reOcrToken))).toBe(false);
    });

    it('enqueue ล้มเหลว (เช่น 503) → คืน pointer เดิม ไม่ทิ้ง pointer queued ค้าง', async () => {
      seedPointer({ status: 'completed', jobId: 'old' });
      const before = store.get(reOcrPointerKey(ATT));
      aiQueue.enqueueAttachmentReOcr.mockRejectedValueOnce(
        Object.assign(new Error('unavailable'), { status: 503 })
      );
      await expect(service.trigger(ATT, 'np-dms-ocr', USER)).rejects.toThrow(
        'unavailable'
      );
      expect(store.get(reOcrPointerKey(ATT))).toBe(before);
    });
  });

  describe('getStatus', () => {
    it('ไม่มี pointer → 404', async () => {
      await expect(service.getStatus(ATT)).rejects.toMatchObject({
        status: 404,
      });
    });
    it('queued/processing → ส่ง status + engine/attempt/starter โดยไม่มี newText', async () => {
      seedPointer({ status: 'processing', attempt: 2 });
      const res = await service.getStatus(ATT);
      expect(res).toMatchObject({
        status: 'processing',
        reOcrToken: TOKEN,
        attempt: 2,
        triggeredByDisplayName: 'Admin A',
      });
      expect(res).not.toHaveProperty('newText');
    });
    it('failed → errorMessage', async () => {
      seedPointer({ status: 'failed', errorMessage: 'boom' });
      expect(await service.getStatus(ATT)).toMatchObject({
        status: 'failed',
        errorMessage: 'boom',
      });
    });
    it('completed → newText/charCount/identical=false', async () => {
      seedPointer({});
      seedPayload('new different text that is fairly long');
      const res = await service.getStatus(ATT);
      expect(res).toMatchObject({
        status: 'completed',
        engineUsed: 'np-dms-ocr',
        identical: false,
        newText: 'new different text that is fairly long',
        currentText: baseAttachment.ocrText,
      });
      expect(res).not.toHaveProperty('warning');
    });
    it('completed + ocr_text เดิมเป็น NULL → currentText = "" (UI แสดง placeholder)', async () => {
      attachmentRepo.findOne.mockResolvedValue({
        ...baseAttachment,
        ocrText: null,
      });
      seedPointer({});
      seedPayload('some new text');
      expect(await service.getStatus(ATT)).toMatchObject({
        currentText: '',
        identical: false,
      });
    });
    it('completed + text เหมือนเดิมเป๊ะ → identical=true', async () => {
      seedPointer({});
      seedPayload(baseAttachment.ocrText);
      expect(await service.getStatus(ATT)).toMatchObject({ identical: true });
    });
    it('completed + สั้นกว่าเดิม <50% → warning RESULT_MUCH_SHORTER', async () => {
      seedPointer({});
      seedPayload('short');
      expect(await service.getStatus(ATT)).toMatchObject({
        warning: 'RESULT_MUCH_SHORTER',
      });
    });
    it('completed แต่ payload หมดอายุ → 404', async () => {
      seedPointer({});
      await expect(service.getStatus(ATT)).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe('confirm', () => {
    beforeEach(() => {
      seedPointer({});
      seedPayload('brand new ocr text');
    });

    it('tx UPDATE (text/rag PENDING/error NULL/DONE) → reingest หลัง commit → DEL keys; ไม่เรียก vector deletion', async () => {
      const order: string[] = [];
      attachmentRepo.manager.transaction.mockImplementationOnce(
        async (cb: (m: { update: jest.Mock }) => Promise<unknown>) => {
          const r = await cb({ update: txUpdate });
          order.push('commit');
          return r;
        }
      );
      ragAdmin.reingest.mockImplementationOnce(() => {
        order.push('reingest');
        return Promise.resolve({ status: 'BUILDING' });
      });
      const res = await service.confirm(ATT, TOKEN);
      expect(order).toEqual(['commit', 'reingest']);
      expect(txUpdate).toHaveBeenCalledWith(
        Attachment,
        { publicId: ATT },
        {
          ocrText: 'brand new ocr text',
          ragStatus: 'PENDING',
          ragLastError: null,
          aiProcessingStatus: 'DONE',
        }
      );
      expect(ragAdmin.reingest).toHaveBeenCalledWith(ATT);
      expect(store.has(reOcrPointerKey(ATT))).toBe(false);
      expect(store.has(reOcrPayloadKey(ATT, TOKEN))).toBe(false);
      expect(res).toMatchObject({
        status: 'confirmed',
        ragStatus: 'PENDING',
        reindexQueued: true,
      });
    });

    it('confirm ซ้ำหลัง keys ถูกลบ → 404', async () => {
      await service.confirm(ATT, TOKEN);
      await expect(service.confirm(ATT, TOKEN)).rejects.toMatchObject({
        status: 404,
      });
    });

    it('token ไม่ตรง/หมดอายุ → 404 และไม่แก้ DB', async () => {
      await expect(
        service.confirm(ATT, '019a0000-0000-7000-8000-0000000000ff')
      ).rejects.toMatchObject({ status: 404 });
      expect(txUpdate).not.toHaveBeenCalled();
    });

    it('attachment ถูกลบแล้ว (affected=0) → 404 และไม่ reingest/ไม่ลบ keys', async () => {
      txUpdate.mockResolvedValueOnce({ affected: 0 });
      await expect(service.confirm(ATT, TOKEN)).rejects.toMatchObject({
        status: 404,
      });
      expect(ragAdmin.reingest).not.toHaveBeenCalled();
    });

    it('reingest ล้มเหลวหลัง commit → ยัง confirmed (reindexQueued=false), keys ถูกลบ, text ถูกแทนที่แล้ว', async () => {
      ragAdmin.reingest.mockRejectedValueOnce(new Error('BUILDING conflict'));
      const res = await service.confirm(ATT, TOKEN);
      expect(res).toMatchObject({ status: 'confirmed', reindexQueued: false });
      expect(store.has(reOcrPayloadKey(ATT, TOKEN))).toBe(false);
    });

    it('pointer ถูก supersede ด้วย token ใหม่กว่า → 409 และไม่แก้ DB/ไม่ลบ keys', async () => {
      seedPointer({ reOcrToken: 'other-token', status: 'processing' });
      await expect(service.confirm(ATT, TOKEN)).rejects.toMatchObject({
        status: 409,
      });
      expect(txUpdate).not.toHaveBeenCalled();
      expect(store.has(reOcrPointerKey(ATT))).toBe(true);
      expect(store.has(reOcrPayloadKey(ATT, TOKEN))).toBe(true);
    });

    it('ผลใหม่ identical กับ ocr_text เดิม → 409 และไม่แก้ DB', async () => {
      seedPayload(baseAttachment.ocrText);
      await expect(service.confirm(ATT, TOKEN)).rejects.toMatchObject({
        status: 409,
      });
      expect(txUpdate).not.toHaveBeenCalled();
      expect(ragAdmin.reingest).not.toHaveBeenCalled();
    });
  });
});
