// File: backend/src/modules/workflow-engine/workflow-event.service.spec.ts
// Change Log:
// - 2026-08-26: สร้าง unit test สำหรับ WorkflowEventService ครอบคลุม dispatchEvents ทุก branch (ADR-008)

import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { WorkflowEventService } from './workflow-event.service';
import type { RawEvent } from './workflow-dsl.service';

describe('WorkflowEventService', () => {
  let service: WorkflowEventService;
  const mockQueue = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowEventService,
        { provide: getQueueToken('workflow-events'), useValue: mockQueue },
      ],
    }).compile();
    service = module.get<WorkflowEventService>(WorkflowEventService);
  });

  it('ควรสร้าง instance ได้', () => {
    expect(service).toBeDefined();
  });

  describe('dispatchEvents()', () => {
    it('ควรข้ามเมื่อ events เป็น empty array', () => {
      service.dispatchEvents('inst-1', [], {});
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('ควรข้ามเมื่อ events เป็น null/undefined', () => {
      service.dispatchEvents('inst-1', null as unknown as RawEvent[], {});
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('ควรเพิ่ม job ลง queue เมื่อมี events', () => {
      const events: RawEvent[] = [
        { type: 'notify', target: 'user1', template: 'email-template' },
      ];
      mockQueue.add.mockResolvedValueOnce(undefined);
      service.dispatchEvents('inst-1', events, { userId: 1 }, 'WF-001');

      expect(mockQueue.add).toHaveBeenCalledWith(
        'process-events',
        {
          instanceId: 'inst-1',
          events,
          context: { userId: 1 },
          workflowCode: 'WF-001',
        },
        expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 500 },
        })
      );
    });

    it('ควรทำงานแบบ fire-and-forget โดยไม่ throw เมื่อ queue.add ล้มเหลว', async () => {
      const events: RawEvent[] = [{ type: 'webhook', payload: { url: 'x' } }];
      mockQueue.add.mockRejectedValueOnce(new Error('Redis down'));

      // ไม่ควร throw เพราะ catch จะ log error
      expect(() => service.dispatchEvents('inst-2', events, {})).not.toThrow();

      // รอให้ promise resolve (catch handler)
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it('ควรส่ง workflowCode เป็น undefined เมื่อไม่ระบุ', () => {
      const events: RawEvent[] = [{ type: 'assign', target: 'user2' }];
      mockQueue.add.mockResolvedValueOnce(undefined);
      service.dispatchEvents('inst-3', events, {});

      expect(mockQueue.add).toHaveBeenCalledWith(
        'process-events',
        expect.objectContaining({
          instanceId: 'inst-3',
          workflowCode: undefined,
        }),
        expect.anything()
      );
    });

    it('ควรจัดการ error ที่ไม่ใช่ Error instance ใน catch', async () => {
      const events: RawEvent[] = [{ type: 'auto_action' }];
      mockQueue.add.mockRejectedValueOnce('string error' as unknown as Error);

      expect(() => service.dispatchEvents('inst-4', events, {})).not.toThrow();

      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  });
});
