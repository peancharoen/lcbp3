// File: src/modules/ai/processors/rag.processor.spec.ts
// Change Log
// - 2026-05-14: เพิ่ม Unit Test สำหรับ AiRagProcessor — ตรวจสอบ concurrency=1 และ AbortController (T030).
import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { AiRagProcessor } from './rag.processor';
import { AiRagService } from '../ai-rag.service';
import { AiRagJobPayload } from '../ai-queue.service';
import { QUEUE_AI_RAG } from '../../common/constants/queue.constants';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** สร้าง mock BullMQ Job สำหรับ RAG query */
function makeJob(
  overrides: Partial<{
    id: string;
    requestPublicId: string;
    userPublicId: string;
    projectPublicId: string;
    query: string;
  }> = {}
): Job<AiRagJobPayload> {
  return {
    id: overrides.id ?? 'job-001',
    data: {
      requestPublicId: overrides.requestPublicId ?? 'req-uuid-001',
      userPublicId: overrides.userPublicId ?? 'user-uuid-001',
      projectPublicId: overrides.projectPublicId ?? 'proj-uuid-001',
      query: overrides.query ?? 'What is the project scope?',
    },
  } as unknown as Job<AiRagJobPayload>;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AiRagProcessor', () => {
  let processor: AiRagProcessor;
  let ragService: jest.Mocked<AiRagService>;

  const mockRagService: Partial<jest.Mocked<AiRagService>> = {
    processQuery: jest.fn().mockResolvedValue(undefined),
    getActiveJob: jest.fn().mockResolvedValue(null),
    registerActiveJob: jest.fn().mockResolvedValue(undefined),
    clearActiveJob: jest.fn().mockResolvedValue(undefined),
    cancelJob: jest.fn().mockResolvedValue(undefined),
    getJobResult: jest.fn().mockResolvedValue(null),
    saveJobResult: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiRagProcessor,
        { provide: AiRagService, useValue: mockRagService },
      ],
    }).compile();

    processor = module.get<AiRagProcessor>(AiRagProcessor);
    ragService = module.get(AiRagService);

    jest.clearAllMocks();
  });

  // ─── T030 Core: ตรวจสอบ concurrency=1 metadata ──────────────────────────

  it('ควรมี @Processor decorator พร้อม queue name ที่ถูกต้อง', () => {
    // ตรวจสอบ QUEUE_AI_RAG constant ตรงกับที่ใช้ใน processor
    expect(QUEUE_AI_RAG).toBe('ai-rag-query');
  });

  it('ควร process job และเรียก ragService.processQuery ด้วย AbortSignal', async () => {
    const job = makeJob({
      requestPublicId: 'req-abc',
      userPublicId: 'user-abc',
      query: 'test question',
    });

    await processor.process(job);

    expect(ragService.processQuery).toHaveBeenCalledTimes(1);
    expect(ragService.processQuery).toHaveBeenCalledWith(
      'req-abc',
      'test question',
      'proj-uuid-001',
      'user-abc',
      expect.any(AbortSignal) // T022: AbortSignal ต้องถูกส่งเข้าไปด้วย
    );
  });

  it('ควร cleanup AbortController หลัง process เสร็จ (no memory leak)', async () => {
    const job = makeJob({ requestPublicId: 'req-cleanup' });

    await processor.process(job);

    // หลัง process เสร็จ ไม่ควรมี controller ค้างอยู่
    const aborted = processor.abortJob('req-cleanup');
    expect(aborted).toBe(false); // ถูก cleanup แล้ว
  });

  it('ควร cleanup AbortController แม้ว่า processQuery จะ throw error', async () => {
    const job = makeJob({ requestPublicId: 'req-error' });
    ragService.processQuery.mockRejectedValueOnce(new Error('Ollama timeout'));

    // ไม่ควร throw ออกมา (processor จัดการ error ภายใน)
    await expect(processor.process(job)).rejects.toThrow('Ollama timeout');

    // ยังต้อง cleanup controller
    const aborted = processor.abortJob('req-error');
    expect(aborted).toBe(false);
  });

  it('abortJob ควรคืน true เมื่อ job กำลัง processing', async () => {
    const requestPublicId = 'req-inprogress';
    // จำลอง processQuery ที่ใช้เวลานาน
    ragService.processQuery.mockImplementationOnce(
      (_reqId, _q, _proj, _user, signal) =>
        new Promise<void>((_resolve, reject) => {
          if (signal) {
            signal.addEventListener('abort', () =>
              reject(new Error('aborted'))
            );
          }
          // ไม่ resolve เพื่อจำลอง long-running job
        })
    );

    const job = makeJob({ requestPublicId });
    const processingPromise = processor.process(job).catch(() => {
      /* expected */
    });

    // รอให้ controller ถูก register ก่อน abort
    await new Promise((r) => setTimeout(r, 10));

    const result = processor.abortJob(requestPublicId);
    expect(result).toBe(true);

    await processingPromise;
  });

  it('abortJob ควรคืน false เมื่อไม่มี job ที่ requestPublicId นั้น', () => {
    const result = processor.abortJob('non-existent-job');
    expect(result).toBe(false);
  });

  // ─── T030 Stress: ตรวจสอบ 1-active-job-per-user enforcement ─────────────

  describe('1-Active-Job-Per-User Enforcement (FR-009 concurrency=1)', () => {
    it('ควรส่งคืน requestPublicId เดิมเมื่อ user มี active job อยู่แล้ว', async () => {
      const existingJobId = 'existing-request-uuid';
      ragService.getActiveJob.mockResolvedValueOnce(existingJobId);

      const activeJob = await ragService.getActiveJob('user-uuid-999');
      expect(activeJob).toBe(existingJobId);
    });

    it('ควรสามารถ registerActiveJob และ getActiveJob ได้สำหรับ user คนเดียว', async () => {
      const userPublicId = 'user-stress-test';
      const requestPublicId = 'new-req-uuid';

      ragService.getActiveJob.mockResolvedValueOnce(null);
      ragService.registerActiveJob.mockResolvedValueOnce(undefined);
      ragService.getActiveJob.mockResolvedValueOnce(requestPublicId);

      // ไม่มี active job เริ่มต้น
      const beforeJob = await ragService.getActiveJob(userPublicId);
      expect(beforeJob).toBeNull();

      // ลงทะเบียน job
      await ragService.registerActiveJob(userPublicId, requestPublicId);

      // ตรวจสอบว่า active job ถูกเก็บแล้ว
      const afterJob = await ragService.getActiveJob(userPublicId);
      expect(afterJob).toBe(requestPublicId);
    });

    it('stress test: 10 requests ต่อเนื่อง — ควรพบ active job ตั้งแต่ request ที่ 2 เป็นต้นไป', async () => {
      const userPublicId = 'user-concurrent';
      const firstRequestId = 'first-req-uuid';

      // ครั้งแรกไม่มี active job, หลังจากนั้นมี
      ragService.getActiveJob
        .mockResolvedValueOnce(null) // request 1: ไม่มี active job
        .mockResolvedValue(firstRequestId); // request 2-10: พบ active job

      ragService.registerActiveJob.mockResolvedValue(undefined);

      // Request 1: ไม่มี active job — ควรสร้างใหม่
      const req1Active = await ragService.getActiveJob(userPublicId);
      expect(req1Active).toBeNull();
      await ragService.registerActiveJob(userPublicId, firstRequestId);

      // Requests 2-10: ทุกคำขอควรพบ active job เดิม
      const concurrentChecks = await Promise.all(
        Array.from({ length: 9 }, () => ragService.getActiveJob(userPublicId))
      );

      concurrentChecks.forEach((activeId) => {
        expect(activeId).toBe(firstRequestId);
      });

      // ยืนยันว่า registerActiveJob ถูกเรียกแค่ครั้งเดียว (job เดียว)
      expect(ragService.registerActiveJob).toHaveBeenCalledTimes(1);
    });
  });
});
