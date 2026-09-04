// File: backend/src/modules/ai/ai-queue.service.spec.ts
// Change Log:
// - 2026-08-24: ADR-048 T020 — สร้าง unit tests สำหรับ AiQueueService
// - 2026-08-26: เพิ่ม regression test — jobId ของ vector deletion ใช้ `-` ไม่ใช่ `:` (Fix 15ff5d08)

import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { AiQueueService } from './ai-queue.service';
import {
  QUEUE_AI_INGEST,
  QUEUE_AI_RAG,
  QUEUE_AI_VECTOR_DELETION,
  QUEUE_AI_BATCH,
  QUEUE_AI_REALTIME,
} from '../common/constants/queue.constants';

const mockJob = (overrides: Record<string, unknown> = {}) => ({
  id: 'job-1',
  name: 'rag-query',
  data: { jobType: 'rag-query' },
  timestamp: 1_000_000,
  attemptsMade: 1,
  processedOn: undefined,
  finishedOn: undefined,
  failedReason: undefined,
  stacktrace: undefined,
  ...overrides,
});

const createMockQueue = () => ({
  getJobs: jest
    .fn()
    .mockResolvedValue([mockJob({ id: '1' }), mockJob({ id: '2' })]),
  getJobCountByTypes: jest.fn().mockResolvedValue(2),
  getJob: jest.fn().mockResolvedValue({
    ...mockJob({ id: '1' }),
    retry: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  }),
  add: jest.fn().mockResolvedValue({ id: 'new-job' }),
  getActiveCount: jest.fn().mockResolvedValue(0),
  getWaitingCount: jest.fn().mockResolvedValue(0),
});

describe('AiQueueService', () => {
  let service: AiQueueService;
  let queues: Record<string, ReturnType<typeof createMockQueue>>;
  const store = new Map<string, string>();

  const mockRedis = {
    get: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    // Bugfix: real ioredis call shape is `set(key, value, 'EX', ttl, 'NX')` — 'NX' is the
    // 5th positional arg, not the 3rd (which is always the literal string 'EX'). เดิมเช็ค
    // เฉพาะ arg ตัวที่ 3 (`mode === 'NX'`) จึงไม่เคย true เลย — NX semantics ไม่เคยถูกจำลองจริง
    // ในเทสไฟล์นี้ (ไม่มีใครสังเกตเพราะไม่มี test เดิมที่พึ่งพา NX ผ่าน mock ตัวนี้โดยตรง)
    set: jest.fn((...args: unknown[]) => {
      const [key, value] = args as [string, string];
      const isNx = args.includes('NX');
      if (isNx && store.has(key)) {
        return Promise.resolve(null);
      }
      store.set(key, value);
      return Promise.resolve('OK');
    }),
    setex: jest.fn((key: string, _ttl: number, value: string) => {
      store.set(key, value);
      return Promise.resolve('OK');
    }),
    del: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve(1);
    }),
    expire: jest.fn((_key: string, _ttl: number) => Promise.resolve(1)),
    eval: jest.fn().mockResolvedValue(1),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    store.clear();
    queues = {
      [QUEUE_AI_INGEST]: createMockQueue(),
      [QUEUE_AI_RAG]: createMockQueue(),
      [QUEUE_AI_VECTOR_DELETION]: createMockQueue(),
      [QUEUE_AI_BATCH]: createMockQueue(),
      [QUEUE_AI_REALTIME]: createMockQueue(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiQueueService,
        {
          provide: getQueueToken(QUEUE_AI_INGEST),
          useValue: queues[QUEUE_AI_INGEST],
        },
        {
          provide: getQueueToken(QUEUE_AI_RAG),
          useValue: queues[QUEUE_AI_RAG],
        },
        {
          provide: getQueueToken(QUEUE_AI_VECTOR_DELETION),
          useValue: queues[QUEUE_AI_VECTOR_DELETION],
        },
        {
          provide: getQueueToken(QUEUE_AI_BATCH),
          useValue: queues[QUEUE_AI_BATCH],
        },
        {
          provide: getQueueToken(QUEUE_AI_REALTIME),
          useValue: queues[QUEUE_AI_REALTIME],
        },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<AiQueueService>(AiQueueService);
  });

  it('ควรสร้าง instance ได้', () => {
    expect(service).toBeDefined();
  });

  describe('getQueueJobs', () => {
    it('ควรดึงรายการ jobs จาก ai-batch พร้อม pagination', async () => {
      const result = await service.getQueueJobs('ai-batch', 'all', 1, 20);
      expect(result.jobs).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(queues[QUEUE_AI_BATCH].getJobs).toHaveBeenCalledWith(
        ['active', 'waiting', 'failed', 'completed', 'delayed'],
        0,
        19
      );
    });

    it('ควรกรองเฉพาะ failed jobs เมื่อ status=failed', async () => {
      await service.getQueueJobs('ai-realtime', 'failed', 2, 10);
      expect(queues[QUEUE_AI_REALTIME].getJobs).toHaveBeenCalledWith(
        ['failed'],
        10,
        19
      );
    });

    it('ควร throw BadRequest เมื่อระบุ queue ทีไม่รองรับ', async () => {
      await expect(
        service.getQueueJobs('unknown', 'all', 1, 20)
      ).rejects.toThrow('Unknown queue');
    });
  });

  describe('retryJob', () => {
    it('ควร retry job ทีมีอยู่', async () => {
      await service.retryJob('ai-batch', 'job-1');
      expect(queues[QUEUE_AI_BATCH].getJob).toHaveBeenCalledWith('job-1');
    });

    it('ควร throw NotFound เมื่อไม่พบ job', async () => {
      queues[QUEUE_AI_BATCH].getJob.mockResolvedValueOnce(null);
      await expect(service.retryJob('ai-batch', 'missing')).rejects.toThrow(
        'not found'
      );
    });
  });

  describe('deleteJob', () => {
    it('ควรลบ job ทีมีอยู่', async () => {
      await service.deleteJob('ai-batch', 'job-1');
      expect(queues[QUEUE_AI_BATCH].getJob).toHaveBeenCalledWith('job-1');
    });

    it('ควร throw NotFound เมื่อไม่พบ job', async () => {
      queues[QUEUE_AI_BATCH].getJob.mockResolvedValueOnce(null);
      await expect(service.deleteJob('ai-batch', 'missing')).rejects.toThrow(
        'not found'
      );
    });
  });

  describe('enqueueClearFailed', () => {
    it('ควร enqueue งาน clear-failed และบันทึก status ลง Redis', async () => {
      const trackingId = await service.enqueueClearFailed(
        'ai-batch',
        'user-pid'
      );
      expect(trackingId).toMatch(/^cf-ai-batch-/);
      expect(queues[QUEUE_AI_BATCH].add).toHaveBeenCalledWith(
        'clear-failed-jobs',
        expect.objectContaining({ targetQueueName: 'ai-batch', trackingId }),
        expect.any(Object)
      );
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `ai:clear_failed:job:${trackingId}`,
        300,
        expect.stringContaining('"status":"queued"')
      );
    });
  });

  describe('getClearFailedStatus', () => {
    it('ควรคืนค่า status จาก Redis', async () => {
      await service.enqueueClearFailed('ai-realtime', 'user-pid');
      const status = await service.getClearFailedStatus('last-tracking');
      expect(status).toBeNull();
    });
  });

  describe('model transition lock guard', () => {
    it('ควร throw Service Unavailable เมื่อมี model transition lock', async () => {
      mockRedis.get.mockResolvedValueOnce('locked');
      await expect(
        service.enqueueRagQuery({
          requestPublicId: 'req-1',
          userPublicId: 'u-1',
          projectPublicId: 'p-1',
          query: 'test',
        })
      ).rejects.toThrow('Service Unavailable');
    });

    it('ควรส่ง RAG query ปกติเมื่อไม่มี lock', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      const jobId = await service.enqueueRagQuery({
        requestPublicId: 'req-1',
        userPublicId: 'u-1',
        projectPublicId: 'p-1',
        query: 'test',
      });
      expect(jobId).toBe('new-job');
    });

    // Bugfix: ยืนยันว่า error ที่ throw จริงมี code = 'AI_FEATURES_UNAVAILABLE' ในตัว response
    // payload — เดิมใช้ raw HttpException ซึ่ง GlobalExceptionFilter overwrite code เป็น
    // 'HTTP_ERROR' เสมอ (ไม่มีทางอ่าน custom code ได้เลย) ทำให้ frontend interceptor ที่เช็ค
    // `code === 'AI_FEATURES_UNAVAILABLE'` ไม่เคย match — ต้องใช้ ServiceUnavailableException
    // (BaseException subclass) response ถึงจะมี error.code ที่ถูกต้องจริงๆ
    it('ควร throw ServiceUnavailableException ที่มี error.code = AI_FEATURES_UNAVAILABLE จริง', async () => {
      store.set('ai:model:transitioning', 'locked');
      let caught: unknown;
      try {
        await service.enqueueRagQuery({
          requestPublicId: 'req-2',
          userPublicId: 'u-1',
          projectPublicId: 'p-1',
          query: 'test',
        });
      } catch (err) {
        caught = err;
      }
      const response = (
        caught as { getResponse: () => { error: { code: string } } }
      ).getResponse();
      expect(response.error.code).toBe('AI_FEATURES_UNAVAILABLE');
    });

    it('ควร throw Service Unavailable เมื่อมี ocr-batch-active lock (แม้ไม่มี model-transitioning lock)', async () => {
      store.set('ai:ocr-batch:active', 'ocr-batch-token-1');
      await expect(
        service.enqueueRagQuery({
          requestPublicId: 'req-3',
          userPublicId: 'u-1',
          projectPublicId: 'p-1',
          query: 'test',
        })
      ).rejects.toThrow('Service Unavailable');
      expect(queues[QUEUE_AI_RAG].add).not.toHaveBeenCalled();
    });
  });

  describe('OCR batch phase lock (acquireOcrBatchLock/heartbeatOcrBatchLock/releaseOcrBatchLock)', () => {
    it('ควร acquire lock สำเร็จและคืน ownership token เมื่อยังไม่มีใคร lock', async () => {
      const token = await service.acquireOcrBatchLock();
      expect(token).not.toBeNull();
      expect(store.get('ai:ocr-batch:active')).toBe(token);
    });

    it('ควร acquire ไม่สำเร็จ (คืน null) เมื่อมี batch อื่น lock ไว้อยู่แล้ว', async () => {
      const first = await service.acquireOcrBatchLock();
      expect(first).not.toBeNull();
      const second = await service.acquireOcrBatchLock();
      expect(second).toBeNull();
    });

    it('ควร heartbeat ต่ออายุ lock เฉพาะเมื่อ ownership token ตรงกัน', async () => {
      const token = await service.acquireOcrBatchLock();
      await service.heartbeatOcrBatchLock(token as string);
      expect(mockRedis.expire).toHaveBeenCalledWith('ai:ocr-batch:active', 30);
    });

    it('ควรไม่ heartbeat (ไม่เรียก expire) ถ้า token ไม่ตรงกับเจ้าของ lock ปัจจุบัน', async () => {
      await service.acquireOcrBatchLock();
      await service.heartbeatOcrBatchLock('some-other-stale-token');
      expect(mockRedis.expire).not.toHaveBeenCalled();
    });

    it('ควร release lock (ลบ key) เมื่อ ownership token ตรงกัน', async () => {
      const token = await service.acquireOcrBatchLock();
      await service.releaseOcrBatchLock(token as string);
      expect(store.has('ai:ocr-batch:active')).toBe(false);
    });

    it('ควรไม่ release lock ถ้า token ไม่ตรงกับเจ้าของ lock ปัจจุบัน (ป้องกันลบ lock ของ batch อื่น)', async () => {
      await service.acquireOcrBatchLock();
      await service.releaseOcrBatchLock('some-other-stale-token');
      expect(store.has('ai:ocr-batch:active')).toBe(true);
    });
  });

  // ─── ADR-048 FR-007: assertQueuesEmpty + getRealtimeQueueSize ──────────────

  describe('FR-007: getRealtimeQueueSize', () => {
    it('ควรคืน active + waiting count ของ realtime queue', async () => {
      queues[QUEUE_AI_REALTIME].getActiveCount.mockResolvedValueOnce(2);
      queues[QUEUE_AI_REALTIME].getWaitingCount.mockResolvedValueOnce(3);
      const size = await service.getRealtimeQueueSize();
      expect(size).toBe(5);
    });
  });

  describe('FR-007: assertQueuesEmpty', () => {
    it('ควรไม่ throw เมื่อทั้งสอง queue ว่าง', async () => {
      queues[QUEUE_AI_BATCH].getActiveCount.mockResolvedValue(0);
      queues[QUEUE_AI_BATCH].getWaitingCount.mockResolvedValue(0);
      queues[QUEUE_AI_REALTIME].getActiveCount.mockResolvedValue(0);
      queues[QUEUE_AI_REALTIME].getWaitingCount.mockResolvedValue(0);
      await expect(service.assertQueuesEmpty()).resolves.toBeUndefined();
    });

    it('ควร throw Conflict (409) เมื่อ ai-batch มี jobs', async () => {
      queues[QUEUE_AI_BATCH].getActiveCount.mockResolvedValue(3);
      queues[QUEUE_AI_BATCH].getWaitingCount.mockResolvedValue(0);
      queues[QUEUE_AI_REALTIME].getActiveCount.mockResolvedValue(0);
      queues[QUEUE_AI_REALTIME].getWaitingCount.mockResolvedValue(0);
      await expect(service.assertQueuesEmpty()).rejects.toThrow('Conflict');
    });

    it('ควร throw Conflict (409) เมื่อ ai-realtime มี jobs', async () => {
      queues[QUEUE_AI_BATCH].getActiveCount.mockResolvedValue(0);
      queues[QUEUE_AI_BATCH].getWaitingCount.mockResolvedValue(0);
      queues[QUEUE_AI_REALTIME].getActiveCount.mockResolvedValue(0);
      queues[QUEUE_AI_REALTIME].getWaitingCount.mockResolvedValue(5);
      await expect(service.assertQueuesEmpty()).rejects.toThrow('Conflict');
    });
  });

  // ─── ADR-048 FR-009: Transition lock on ALL enqueue paths ──────────────────

  describe('FR-009: transition lock on enqueueIngest', () => {
    it('ควร throw 503 เมื่อมี transition lock และเรียก enqueueIngest', async () => {
      store.set('ai:model:transitioning', 'locked');
      await expect(
        service.enqueueIngest({
          batchId: 'batch-1',
          filePublicIds: ['file-1'],
          source: 'api',
        })
      ).rejects.toThrow('Service Unavailable');
      expect(queues[QUEUE_AI_INGEST].add).not.toHaveBeenCalled();
    });

    it('ควรส่ง ingest ปกติเมื่อไม่มี lock', async () => {
      const jobId = await service.enqueueIngest({
        batchId: 'batch-1',
        filePublicIds: ['file-1'],
        source: 'api',
      });
      expect(jobId).toBe('new-job');
      expect(queues[QUEUE_AI_INGEST].add).toHaveBeenCalled();
    });
  });

  describe('FR-009: transition lock on enqueueVectorDeletion', () => {
    it('ควร throw 503 เมื่อมี transition lock และเรียก enqueueVectorDeletion', async () => {
      store.set('ai:model:transitioning', 'locked');
      await expect(
        service.enqueueVectorDeletion({
          documentPublicId: 'doc-1',
          projectPublicId: 'proj-1',
          requestedByUserPublicId: 'user-1',
        })
      ).rejects.toThrow('Service Unavailable');
      expect(queues[QUEUE_AI_VECTOR_DELETION].add).not.toHaveBeenCalled();
    });

    it('ควรส่ง vector deletion ปกติเมื่อไม่มี lock', async () => {
      const jobId = await service.enqueueVectorDeletion({
        documentPublicId: 'doc-1',
        projectPublicId: 'proj-1',
        requestedByUserPublicId: 'user-1',
      });
      expect(jobId).toBe('new-job');
      expect(queues[QUEUE_AI_VECTOR_DELETION].add).toHaveBeenCalled();
    });
  });

  describe('FR-009: transition lock on enqueueClearFailed', () => {
    it('ควร throw 503 เมื่อมี transition lock และเรียก enqueueClearFailed', async () => {
      store.set('ai:model:transitioning', 'locked');
      await expect(
        service.enqueueClearFailed('ai-batch', 'user-pid')
      ).rejects.toThrow('Service Unavailable');
      expect(queues[QUEUE_AI_BATCH].add).not.toHaveBeenCalled();
    });
  });

  describe('FR-009: atomic lock acquisition (SET NX EX with ownership token)', () => {
    it('ควรใช้ atomic SET NX EX สำหรับ lock acquisition (ไม่ใช่ SETEX แบบ unconditional)', async () => {
      // VramMonitorService จะเรียก acquireTransitionLock ผ่าน Redis
      // ตรวจสอบว่าใช้ SET NX EX ไม่ใช่ SETEX
      // (test นี้จะถูก validate ใน vram-monitor.service.spec.ts)
      // ที่นี่ตรวจเพียงว่า lock check ใช้ GET ตามปกติ
      mockRedis.get.mockResolvedValueOnce(null);
      await service.enqueueRagQuery({
        requestPublicId: 'req-atomic',
        userPublicId: 'u-1',
        projectPublicId: 'p-1',
        query: 'test',
      });
      expect(mockRedis.get).toHaveBeenCalledWith('ai:model:transitioning');
    });
  });

  // Regression (15ff5d08): `:` ใน jobId ชนกับ key namespace ของ BullMQ ทำให้หา job ไม่เจอ
  // (retry/remove/getJob ล้มเหลว) — jobId ของ vector deletion ต้องใช้ `-` เป็นตัวคั่น
  describe('regression: jobId separator ของ enqueueVectorDeletion', () => {
    it('ควรสร้าง jobId เป็น `{projectPublicId}-{documentPublicId}` ไม่มี `:`', async () => {
      await service.enqueueVectorDeletion({
        documentPublicId: 'doc-uuid-1',
        projectPublicId: 'proj-uuid-1',
        requestedByUserPublicId: 'user-1',
      });

      expect(queues[QUEUE_AI_VECTOR_DELETION].add).toHaveBeenCalledWith(
        'delete-document-vectors',
        expect.any(Object),
        expect.objectContaining({ jobId: 'proj-uuid-1-doc-uuid-1' })
      );
      const [, , options] = queues[QUEUE_AI_VECTOR_DELETION].add.mock
        .calls[0] as [string, unknown, { jobId: string }];
      expect(options.jobId).not.toContain(':');
    });
  });
});
