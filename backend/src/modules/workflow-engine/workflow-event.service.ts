// File: src/modules/workflow-engine/workflow-event.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RawEvent } from './workflow-dsl.service';

// Interface สำหรับ External Services ที่จะมารับ Event ต่อ
// (ในอนาคตควรใช้ NestJS Event Emitter เพื่อ Decouple อย่างสมบูรณ์)
export interface WorkflowEventHandler {
  handleNotification(
    target: string,
    template: string,
    payload: Record<string, unknown>
  ): Promise<void>;
  handleWebhook(url: string, payload: Record<string, unknown>): Promise<void>;
  handleAutoAction(instanceId: string, action: string): Promise<void>;
}

@Injectable()
export class WorkflowEventService {
  private readonly logger = new Logger(WorkflowEventService.name);

  constructor(
    // ADR-008: ใช้ BullMQ queue แทน inline processing เพื่อ Retry + DLQ (FR-005)
    @InjectQueue('workflow-events')
    private readonly workflowEventQueue: Queue
  ) {}

  /**
   * เพิ่ม Job ลงใน workflow-events queue (ADR-008: Async ไม่ Block Response)
   * Processor: WorkflowEventProcessor (workflow-event.processor.ts)
   */
  dispatchEvents(
    instanceId: string,
    events: RawEvent[],
    context: Record<string, unknown>,
    workflowCode?: string
  ): void {
    if (!events || events.length === 0) return;

    this.logger.log(
      `Enqueuing ${events.length} event(s) for Instance ${instanceId} → workflow-events queue`
    );

    // ADR-008: Fire-and-forget — ไม่ await เพื่อไม่กระทบ Response Time
    // WorkflowEventProcessor จะประมวลผลและ retry อัตโนมัติ (3 retries, exponential backoff)
    void this.workflowEventQueue
      .add(
        'process-events',
        { instanceId, events, context, workflowCode },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 500 },
          removeOnComplete: { age: 86_400 }, // เก็บ 24h
          removeOnFail: false, // เก็บไว้ใน Bull Board + DLQ
        }
      )
      .catch((err: unknown) =>
        this.logger.error(
          `Failed to enqueue workflow events for ${instanceId}: ${
            err instanceof Error ? err.message : String(err)
          }`
        )
      );
  }
}
