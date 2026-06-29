// File: src/modules/workflow-engine/workflow-event.processor.ts
// FR-005/FR-006: BullMQ Processor สำหรับ workflow-events queue พร้อม Dead-Letter Queue

import {
  Processor,
  WorkerHost,
  OnWorkerEvent,
  InjectQueue,
} from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { RawEvent } from './workflow-dsl.service';

export interface WorkflowEventJobData {
  instanceId: string;
  events: RawEvent[];
  context: Record<string, unknown>;
  workflowCode?: string;
}

@Processor('workflow-events', {
  concurrency: 5,
  limiter: { max: 100, duration: 60_000 },
})
export class WorkflowEventProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkflowEventProcessor.name);

  constructor(
    // FR-006: Queue สำหรับ Dead-Letter (jobs ที่หมด retry)
    @InjectQueue('workflow-events-failed')
    private readonly failedQueue: Queue
  ) {
    super();
  }

  // ADR-008: ประมวลผล workflow event job
  process(job: Job<WorkflowEventJobData>): Promise<void> {
    const { instanceId, events } = job.data;
    this.logger.log(
      `Processing ${events.length} event(s) for Instance ${instanceId} (Job: ${job.id})`
    );

    // ประมวลผลแต่ละ event (throw เพื่อให้ BullMQ retry อัตโนมัติ)
    for (const event of events) {
      this.processSingleEvent(instanceId, event, job.data.context);
    }
    return Promise.resolve();
  }

  // FR-006: Dead-Letter Queue handler — เรียกเมื่อ job หมด retry ทั้งหมด
  @OnWorkerEvent('failed')
  async onJobFailed(
    job: Job<WorkflowEventJobData>,
    error: Error
  ): Promise<void> {
    const maxAttempts = job.opts.attempts ?? 3;
    if ((job.attemptsMade ?? 0) < maxAttempts) {
      // ยังมี retry เหลือ — ไม่ต้องส่ง DLQ
      return;
    }

    this.logger.error(
      `Job ${job.id} exhausted all ${maxAttempts} retries for Instance ${job.data.instanceId}: ${error.message}`
    );

    // ส่งไปยัง Dead-Letter Queue
    await this.failedQueue
      .add('dead-letter', {
        originalJobId: job.id,
        queue: 'workflow-events',
        data: job.data,
        failedAt: new Date().toISOString(),
        error: error.message,
      })
      .catch((dlqErr: unknown) =>
        this.logger.error(
          `Failed to add job ${job.id} to DLQ: ${dlqErr instanceof Error ? dlqErr.message : String(dlqErr)}`
        )
      );

    // แจ้ง Ops ผ่าน n8n webhook (ถ้าตั้งค่าไว้)
    const webhookUrl = process.env['N8N_WEBHOOK_URL'];
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'workflow_event_failed',
          jobId: job.id,
          workflowCode: job.data.workflowCode,
          instanceId: job.data.instanceId,
          error: error.message,
          timestamp: new Date().toISOString(),
        }),
      }).catch((webhookErr: unknown) => {
        // Warning เท่านั้น — ไม่ throw เพื่อไม่กระทบ DLQ add ที่สำเร็จแล้ว
        this.logger.warn(
          `n8n webhook failed for job ${job.id}: ${webhookErr instanceof Error ? webhookErr.message : String(webhookErr)}`
        );
      });
    } else {
      this.logger.warn(
        `N8N_WEBHOOK_URL not configured — DLQ job created without ops notification (job: ${job.id})`
      );
    }
  }

  // --- Private Handlers ---

  private processSingleEvent(
    instanceId: string,
    event: RawEvent,
    _context: Record<string, unknown>
  ): void {
    switch (event.type) {
      case 'notify':
        this.logger.log(
          `[NOTIFY] Instance ${instanceId} → target: "${event.target}" | template: "${event.template}"`
        );
        break;
      case 'webhook':
        this.logger.log(
          `[WEBHOOK] Instance ${instanceId} → url: "${event.target}"`
        );
        break;
      case 'auto_action':
        this.logger.log(`[AUTO_ACTION] Instance ${instanceId}`);
        break;
      default:
        this.logger.warn(`Unknown event type: ${event.type} for ${instanceId}`);
    }
  }
}
