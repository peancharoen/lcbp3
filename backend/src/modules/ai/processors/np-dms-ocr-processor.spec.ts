// File: src/modules/ai/processors/np-dms-ocr-processor.spec.ts
// Change Log
// - 2026-09-19: ADR-055 D15 (T014) — re-OCR branch: pointer/payload, forceRefresh, conditional VRAM, empty→failed
// - 2026-09-19: ADR-055 D10 (T004) — พิสูจน์ว่าทุก failure path (VRAM gate + catch) เขียน
//   status:'failed' ลง Redis เฉพาะ attempt สุดท้าย; attempt ก่อนหน้าไม่เขียน failed

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { AiAuditLog } from '../entities/ai-audit-log.entity';
import { OcrCacheService } from '../services/ocr-cache.service';
import { VramMonitorService } from '../services/vram-monitor.service';
import { SandboxOcrEngineService } from '../services/sandbox-ocr-engine.service';
import { NpDmsOcrJobData, NpDmsOcrProcessor } from './np-dms-ocr-processor';

const REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

const makeJob = (attemptsMade: number, attempts = 3): Job<NpDmsOcrJobData> =>
  ({
    id: 'job-1',
    attemptsMade,
    opts: { attempts },
    data: {
      pdfPath: '/files/a.pdf',
      engineType: 'np-dms-ocr',
      idempotencyKey: 'idem-1',
      documentPublicId: 'doc-1',
    },
  }) as unknown as Job<NpDmsOcrJobData>;

describe('NpDmsOcrProcessor — D10 failure reporting (ADR-055)', () => {
  let processor: NpDmsOcrProcessor;
  const redis = { setex: jest.fn(), get: jest.fn() };
  const auditRepo = {
    create: jest.fn().mockReturnValue({}),
    save: jest.fn().mockResolvedValue({}),
  };
  const cache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  };
  const vram = {
    hasVramCapacity: jest.fn(),
    invalidateCache: jest.fn().mockResolvedValue(undefined),
  };
  const engine = { detectAndExtract: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    redis.setex.mockResolvedValue('OK');
    cache.get.mockResolvedValue(null);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NpDmsOcrProcessor,
        { provide: REDIS_TOKEN, useValue: redis },
        { provide: getRepositoryToken(AiAuditLog), useValue: auditRepo },
        { provide: OcrCacheService, useValue: cache },
        { provide: VramMonitorService, useValue: vram },
        { provide: SandboxOcrEngineService, useValue: engine },
      ],
    }).compile();
    processor = module.get(NpDmsOcrProcessor);
  });

  const failedWrites = (): string[][] =>
    (redis.setex.mock.calls as string[][]).filter(
      (c) =>
        c[0] === 'ai:np-dms-ocr:idem-1' &&
        (JSON.parse(c[2]) as { status: string }).status === 'failed'
    );

  it('VRAM gate + attempt สุดท้าย → เขียน failed พร้อม errorMessage แล้ว throw', async () => {
    vram.hasVramCapacity.mockResolvedValue(false);
    await expect(processor.process(makeJob(2))).rejects.toThrow();
    const writes = failedWrites();
    expect(writes).toHaveLength(1);
    const body = JSON.parse(writes[0][2]) as {
      status: string;
      errorMessage: string;
      failedAt: string;
    };
    expect(body.errorMessage).toContain('VRAM');
    expect(body.failedAt).toBeDefined();
  });

  it('catch path + attempt สุดท้าย → เขียน failed แล้ว throw ต่อ', async () => {
    vram.hasVramCapacity.mockResolvedValue(true);
    engine.detectAndExtract.mockRejectedValue(new Error('sidecar timeout'));
    await expect(processor.process(makeJob(2))).rejects.toThrow(
      'sidecar timeout'
    );
    const writes = failedWrites();
    expect(writes).toHaveLength(1);
    expect(
      (JSON.parse(writes[0][2]) as { errorMessage: string }).errorMessage
    ).toBe('sidecar timeout');
  });

  it.each([0, 1])(
    'attempt %i (ยังมี retry เหลือ) → ไม่เขียน failed ทั้ง 2 path',
    async (attemptsMade) => {
      vram.hasVramCapacity.mockResolvedValueOnce(false);
      await expect(processor.process(makeJob(attemptsMade))).rejects.toThrow();
      vram.hasVramCapacity.mockResolvedValueOnce(true);
      engine.detectAndExtract.mockRejectedValueOnce(new Error('boom'));
      await expect(processor.process(makeJob(attemptsMade))).rejects.toThrow(
        'boom'
      );
      expect(failedWrites()).toHaveLength(0);
    }
  );
});

describe('NpDmsOcrProcessor — re-OCR branch (ADR-055 D15)', () => {
  let processor: NpDmsOcrProcessor;
  const store = new Map<string, string>();
  const redis = {
    get: jest.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
    setex: jest.fn((k: string, _ttl: number, v: string) => {
      store.set(k, v);
      return Promise.resolve('OK');
    }),
  };
  const auditRepo = {
    create: jest.fn().mockReturnValue({}),
    save: jest.fn().mockResolvedValue({}),
  };
  const cache = {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
  };
  const vram = {
    hasVramCapacity: jest.fn(),
    invalidateCache: jest.fn().mockResolvedValue(undefined),
  };
  const engine = { detectAndExtract: jest.fn() };
  const POINTER = 'attachment:re-ocr:att-1';
  const PAYLOAD = 'attachment:re-ocr:att-1:tok-1';

  const reOcrJob = (
    overrides: Partial<NpDmsOcrJobData> = {},
    attemptsMade = 0
  ): Job<NpDmsOcrJobData> =>
    ({
      id: 're-ocr-att-1-tok-1',
      attemptsMade,
      opts: { attempts: 3 },
      data: {
        pdfPath: '/files/a.pdf',
        engineType: 'np-dms-ocr',
        idempotencyKey: 'tok-1',
        documentPublicId: 'att-1',
        attachmentPublicId: 'att-1',
        reOcrToken: 'tok-1',
        forceRefresh: true,
        triggeredByDisplayName: 'Admin A',
        triggeredAt: '2026-09-19T00:00:00.000Z',
        ...overrides,
      },
    }) as unknown as Job<NpDmsOcrJobData>;

  const pointer = (): Record<string, unknown> =>
    JSON.parse(store.get(POINTER) ?? '{}') as Record<string, unknown>;

  beforeEach(async () => {
    jest.clearAllMocks();
    store.clear();
    store.set(
      POINTER,
      JSON.stringify({
        status: 'queued',
        reOcrToken: 'tok-1',
        jobId: 're-ocr-att-1-tok-1',
        engineType: 'np-dms-ocr',
        triggeredByDisplayName: 'Admin A',
        triggeredAt: '2026-09-19T00:00:00.000Z',
      })
    );
    cache.get.mockResolvedValue({ text: 'STALE', engineUsed: 'x' });
    vram.hasVramCapacity.mockResolvedValue(true);
    engine.detectAndExtract.mockResolvedValue({
      text: 'new text',
      engineUsed: 'np-dms-ocr',
      fallbackUsed: false,
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NpDmsOcrProcessor,
        { provide: REDIS_TOKEN, useValue: redis },
        { provide: getRepositoryToken(AiAuditLog), useValue: auditRepo },
        { provide: OcrCacheService, useValue: cache },
        { provide: VramMonitorService, useValue: vram },
        { provide: SandboxOcrEngineService, useValue: engine },
      ],
    }).compile();
    processor = module.get(NpDmsOcrProcessor);
  });

  it('forceRefresh: ข้าม cache.get() (ไม่คืน text เก่า) แต่ยัง cache.set() ผลใหม่', async () => {
    await processor.process(reOcrJob());
    expect(cache.get).not.toHaveBeenCalled();
    expect(engine.detectAndExtract).toHaveBeenCalled();
    expect(cache.set).toHaveBeenCalledWith(
      '/files/a.pdf',
      'np-dms-ocr',
      expect.objectContaining({ text: 'new text' })
    );
  });

  it('สำเร็จ: เขียน payload key (TTL 72h) + pointer completed โดยรักษา triggeredBy เดิม', async () => {
    await processor.process(reOcrJob());
    const payload = JSON.parse(store.get(PAYLOAD) ?? '{}') as Record<
      string,
      unknown
    >;
    expect(payload).toMatchObject({
      newText: 'new text',
      engineUsed: 'np-dms-ocr',
      charCount: 8,
    });
    expect(redis.setex).toHaveBeenCalledWith(
      PAYLOAD,
      72 * 3600,
      expect.any(String)
    );
    expect(pointer()).toMatchObject({
      status: 'completed',
      reOcrToken: 'tok-1',
      triggeredByDisplayName: 'Admin A',
    });
  });

  it('replace mode (D17): copy mode/link/candidate fields จาก job data ลง payload', async () => {
    await processor.process(
      reOcrJob({
        mode: 'replace',
        targetCorrespondencePublicId: 'corr-1',
        candidateAttachmentPublicId: 'cand-1',
        candidateFilename: 'new-file.pdf',
        candidateSource: 'UPLOAD',
      })
    );
    const payload = JSON.parse(store.get(PAYLOAD) ?? '{}') as Record<
      string,
      unknown
    >;
    expect(payload).toMatchObject({
      mode: 'replace',
      targetCorrespondencePublicId: 'corr-1',
      candidateAttachmentPublicId: 'cand-1',
      candidateFilename: 'new-file.pdf',
      candidateSource: 'UPLOAD',
    });
  });

  it('plain re-OCR (ไม่มี mode) → payload ไม่มี replace fields', async () => {
    await processor.process(reOcrJob());
    const payload = JSON.parse(store.get(PAYLOAD) ?? '{}') as Record<
      string,
      unknown
    >;
    expect(payload).not.toHaveProperty('mode');
    expect(payload).not.toHaveProperty('candidateAttachmentPublicId');
  });

  it('เริ่ม attempt: pointer = processing พร้อม attempt', async () => {
    let seen: Record<string, unknown> = {};
    engine.detectAndExtract.mockImplementationOnce(() => {
      seen = pointer();
      return Promise.resolve({ text: 't', engineUsed: 'np-dms-ocr' });
    });
    await processor.process(reOcrJob({}, 1));
    expect(seen).toMatchObject({ status: 'processing', attempt: 2 });
  });

  it("VRAM gate: engineType='np-dms-ocr' + VRAM ไม่พอ → fail; 'auto' → ข้าม gate", async () => {
    vram.hasVramCapacity.mockResolvedValue(false);
    await expect(processor.process(reOcrJob({}, 2))).rejects.toThrow();
    expect(pointer()).toMatchObject({ status: 'failed' });
    store.set(POINTER, JSON.stringify({ ...pointer(), status: 'queued' }));
    vram.hasVramCapacity.mockClear();
    await processor.process(reOcrJob({ engineType: 'auto' }));
    expect(vram.hasVramCapacity).not.toHaveBeenCalled();
    expect(pointer()).toMatchObject({ status: 'completed' });
  });

  it('text ว่างเปล่า → pointer failed (ไม่ใช่ completed), ไม่เขียน payload/cache, ไม่ throw', async () => {
    engine.detectAndExtract.mockResolvedValue({
      text: '  \n ',
      engineUsed: 'np-dms-ocr',
    });
    await processor.process(reOcrJob());
    expect(pointer()).toMatchObject({ status: 'failed' });
    expect(String(pointer().errorMessage)).toMatch(/ว่างเปล่า/);
    expect(store.has(PAYLOAD)).toBe(false);
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('attempt ก่อนสุดท้าย fail → pointer ยังเป็น processing; attempt สุดท้าย → failed + errorMessage', async () => {
    engine.detectAndExtract.mockRejectedValue(new Error('sidecar timeout'));
    await expect(processor.process(reOcrJob({}, 0))).rejects.toThrow();
    expect(pointer()).toMatchObject({ status: 'processing' });
    await expect(processor.process(reOcrJob({}, 2))).rejects.toThrow();
    expect(pointer()).toMatchObject({
      status: 'failed',
      errorMessage: 'sidecar timeout',
    });
  });

  it('pointer ถูก supersede ด้วย token ใหม่ → job เก่าไม่เขียนทับ pointer', async () => {
    store.set(
      POINTER,
      JSON.stringify({ ...pointer(), reOcrToken: 'tok-NEW', status: 'queued' })
    );
    await processor.process(reOcrJob());
    expect(pointer()).toMatchObject({
      reOcrToken: 'tok-NEW',
      status: 'queued',
    });
  });

  it('job ที่ไม่มี reOcrToken → พฤติกรรมเดิม (ใช้ cache, ไม่แตะ pointer)', async () => {
    const job = reOcrJob({
      reOcrToken: undefined,
      attachmentPublicId: undefined,
      forceRefresh: undefined,
    });
    await processor.process(job);
    expect(cache.get).toHaveBeenCalled();
    expect(pointer()).toMatchObject({ status: 'queued' });
  });
});
