// File: src/modules/workflow-engine/workflow-event.processor.spec.ts
// T026: Unit tests for WorkflowEventProcessor DLQ + n8n webhook (FR-005, FR-006)

import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { WorkflowEventProcessor } from './workflow-event.processor';
import type { WorkflowEventJobData } from './workflow-event.processor';
import type { Job } from 'bullmq';

// Mock global fetch สำหรับ n8n webhook
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('WorkflowEventProcessor', () => {
  let processor: WorkflowEventProcessor;
  let failedQueue: { add: jest.Mock };

  const makeJob = (
    overrides: Partial<{
      id: string;
      attemptsMade: number;
      opts: { attempts: number };
      data: Record<string, unknown>;
    }> = {}
  ) =>
    ({
      id: 'job-001',
      attemptsMade: 3,
      opts: { attempts: 3 },
      data: {
        instanceId: 'inst-wf-1',
        events: [{ type: 'notify', target: 'admin', template: 'APPROVED' }],
        context: {},
        workflowCode: 'RFA_V1',
      },
      ...overrides,
    }) as unknown as Job<WorkflowEventJobData>;

  beforeEach(async () => {
    failedQueue = { add: jest.fn().mockResolvedValue(undefined) };
    mockFetch.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowEventProcessor,
        {
          provide: getQueueToken('workflow-events-failed'),
          useValue: failedQueue,
        },
      ],
    }).compile();

    processor = module.get<WorkflowEventProcessor>(WorkflowEventProcessor);
  });

  afterEach(() => {
    delete process.env['N8N_WEBHOOK_URL'];
  });

  describe('onJobFailed()', () => {
    it('T026a: should add dead-letter job to workflow-events-failed queue when attempts exhausted', async () => {
      // Arrange: job.attemptsMade === job.opts.attempts (หมด retry)
      const job = makeJob({ attemptsMade: 3, opts: { attempts: 3 } });
      const error = new Error('Notification service timeout');

      // Act
      await processor.onJobFailed(job, error);

      // Assert: ส่งไปยัง DLQ
      expect(failedQueue.add).toHaveBeenCalledWith(
        'dead-letter',
        expect.objectContaining({
          originalJobId: 'job-001',
          queue: 'workflow-events',
          error: 'Notification service timeout',
          data: expect.objectContaining({ instanceId: 'inst-wf-1' }),
        })
      );
    });

    it('T026b: should NOT add to DLQ when job still has retry attempts remaining', async () => {
      // Arrange: attempt 1 of 3 — ยังมี retry เหลือ
      const job = makeJob({ attemptsMade: 1, opts: { attempts: 3 } });
      const error = new Error('Temporary error');

      // Act
      await processor.onJobFailed(job, error);

      // Assert: ไม่ส่ง DLQ
      expect(failedQueue.add).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('T026c: should POST to n8n webhook when N8N_WEBHOOK_URL is configured', async () => {
      // Arrange: ตั้งค่า webhook URL
      process.env['N8N_WEBHOOK_URL'] = 'https://n8n.example.com/webhook/dlq';
      mockFetch.mockResolvedValue({ ok: true });

      const job = makeJob({ attemptsMade: 3, opts: { attempts: 3 } });
      const error = new Error('Service down');

      // Act
      await processor.onJobFailed(job, error);

      // Assert: เรียก n8n webhook
      expect(mockFetch).toHaveBeenCalledWith(
        'https://n8n.example.com/webhook/dlq',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"event":"workflow_event_failed"'),
        })
      );

      // Body ต้องมี workflowCode + instanceId
      const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(callArgs[1].body as string) as Record<
        string,
        unknown
      >;
      expect(body).toMatchObject({
        event: 'workflow_event_failed',
        jobId: 'job-001',
        workflowCode: 'RFA_V1',
        instanceId: 'inst-wf-1',
        error: 'Service down',
      });
    });

    it('T026d: should warn (not throw) when N8N_WEBHOOK_URL is not set', async () => {
      // Arrange: ไม่ตั้ง env var
      delete process.env['N8N_WEBHOOK_URL'];

      const job = makeJob({ attemptsMade: 3, opts: { attempts: 3 } });
      const error = new Error('Error');

      // Act — ต้องไม่ throw
      await expect(processor.onJobFailed(job, error)).resolves.toBeUndefined();

      // DLQ ยังต้องถูกเรียก — แค่ไม่ call webhook
      expect(failedQueue.add).toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('T026e: should continue without throwing when DLQ add fails', async () => {
      // Arrange: DLQ queue ล้มเหลว — ไม่ควร throw ออกมา
      failedQueue.add.mockRejectedValueOnce(new Error('Redis DLQ down'));

      const job = makeJob({ attemptsMade: 3, opts: { attempts: 3 } });
      const error = new Error('Original error');

      // Act: ต้อง resolve ปกติ ไม่ throw
      await expect(processor.onJobFailed(job, error)).resolves.toBeUndefined();
    });
  });

  describe('process()', () => {
    it('T026f: should process notify event without error', async () => {
      const job = makeJob();

      // Act — ต้อง resolve ปกติ
      await expect(processor.process(job)).resolves.toBeUndefined();
    });
  });
});
