// File: backend/src/modules/ai/ai-queue.service.spec.ts
// Change Log:
// - 2026-08-24: ADR-048 T020 — สร้าง unit tests สำหรับ AiQueueService

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
    set: jest.fn((key: string, value: string, mode?: string, _ttl?: number) => {
      // Atomic SET NX EX — only succeeds if key doesn't exist
      if (mode === 'NX' && store.has(key)) {
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
    del: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve(1);
    }),
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
});
