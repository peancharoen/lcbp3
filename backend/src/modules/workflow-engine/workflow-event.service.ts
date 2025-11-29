// File: src/modules/workflow-engine/workflow-event.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { RawEvent } from './workflow-dsl.service';

// Interface สำหรับ External Services ที่จะมารับ Event ต่อ
// (ในอนาคตควรใช้ NestJS Event Emitter เพื่อ Decouple อย่างสมบูรณ์)
export interface WorkflowEventHandler {
  handleNotification(
    target: string,
    template: string,
    payload: any,
  ): Promise<void>;
  handleWebhook(url: string, payload: any): Promise<void>;
  handleAutoAction(instanceId: string, action: string): Promise<void>;
}

@Injectable()
export class WorkflowEventService {
  private readonly logger = new Logger(WorkflowEventService.name);

  // สามารถ Inject NotificationService หรือ HttpService เข้ามาได้ตรงนี้
  // constructor(private readonly notificationService: NotificationService) {}

  /**
   * ประมวลผลรายการ Events ที่เกิดจากการเปลี่ยนสถานะ
   */
  async dispatchEvents(
    instanceId: string,
    events: RawEvent[],
    context: Record<string, any>,
  ) {
    if (!events || events.length === 0) return;

    this.logger.log(
      `Dispatching ${events.length} events for Instance ${instanceId}`,
    );

    // ทำแบบ Async ไม่รอผล (Fire-and-forget) เพื่อไม่ให้กระทบ Response Time ของ User
    Promise.allSettled(
      events.map((event) =>
        this.processSingleEvent(instanceId, event, context),
      ),
    ).then((results) => {
      // Log errors if any
      results.forEach((res, idx) => {
        if (res.status === 'rejected') {
          this.logger.error(`Failed to process event [${idx}]: ${res.reason}`);
        }
      });
    });
  }

  private async processSingleEvent(
    instanceId: string,
    event: RawEvent,
    context: any,
  ) {
    try {
      switch (event.type) {
        case 'notify':
          await this.handleNotify(event, context);
          break;
        case 'webhook':
          await this.handleWebhook(event, context);
          break;
        case 'auto_action':
          // Logic สำหรับ Auto Transition (เช่น ถ้าผ่านเงื่อนไข ให้ไปต่อเลย)
          this.logger.log(`Auto Action triggered for ${instanceId}`);
          break;
        default:
          this.logger.warn(`Unknown event type: ${event.type}`);
      }
    } catch (error) {
      this.logger.error(`Error processing event ${event.type}: ${error}`);
      throw error;
    }
  }

  // --- Handlers ---

  private async handleNotify(event: RawEvent, context: any) {
    // Mockup: ในของจริงจะเรียก NotificationService.send()
    // const recipients = this.resolveRecipients(event.target, context);
    this.logger.log(
      `[EVENT] Notify target: "${event.target}" | Template: "${event.template}"`,
    );
  }

  private async handleWebhook(event: RawEvent, context: any) {
    // Mockup: เรียก HttpService.post()
    this.logger.log(
      `[EVENT] Webhook to: "${event.target}" | Payload: ${JSON.stringify(event.payload)}`,
    );
  }
}
