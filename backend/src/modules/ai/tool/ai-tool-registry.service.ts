// File: src/modules/ai/tool/ai-tool-registry.service.ts
// Change Log
// - 2026-05-19: สร้าง AiToolRegistryService — Static Map จาก ServerIntent ไปยัง Tool Handlers (ADR-025).
// - 2026-05-19: เพิ่ม Audit Logging สำหรับทุก Tool Execution (ADR-023, FR-005).

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { ServerIntent } from './types/server-intent.enum';
import { ToolCallResult } from './types/tool-call-result.type';
import { ToolHandlerContext } from './types/tool-handler-context.type';
import { RfaToolService } from './rfa-tool.service';
import { DrawingToolService } from './drawing-tool.service';
import { TransmittalToolService } from './transmittal-tool.service';
import { AiAuditLog, AiAuditStatus } from '../entities/ai-audit-log.entity';

/** ชนิดของ Tool Handler function */
type ToolHandler = (
  context: ToolHandlerContext
) => Promise<ToolCallResult<unknown>>;

@Injectable()
export class AiToolRegistryService {
  private readonly logger = new Logger(AiToolRegistryService.name);
  /** Static Map จาก ServerIntent ไปยัง Tool Handler */
  private readonly handlerMap: Map<ServerIntent, ToolHandler>;

  constructor(
    private readonly rfaToolService: RfaToolService,
    private readonly drawingToolService: DrawingToolService,
    private readonly transmittalToolService: TransmittalToolService,
    @InjectRepository(AiAuditLog)
    private readonly auditLogRepo: Repository<AiAuditLog>
  ) {
    // ลงทะเบียน handlers ใน Static Map ตาม ADR-025
    this.handlerMap = new Map<ServerIntent, ToolHandler>([
      [ServerIntent.GET_RFA, (ctx) => this.rfaToolService.getRfa(ctx)],
      [
        ServerIntent.GET_DRAWING,
        (ctx) => this.drawingToolService.getDrawing(ctx),
      ],
      [
        ServerIntent.GET_TRANSMITTAL,
        (ctx) => this.transmittalToolService.getTransmittal(ctx),
      ],
    ]);
  }

  /**
   * ส่ง Intent ไปยัง Tool Handler ที่ตรงกัน
   * พร้อม Audit Logging ทุก Execution (FR-005)
   */
  async dispatch(
    intent: string,
    context: ToolHandlerContext
  ): Promise<ToolCallResult<unknown>> {
    const startMs = Date.now();
    const handler = this.handlerMap.get(intent as ServerIntent);
    if (!handler) {
      this.logger.warn(`ไม่พบ Handler สำหรับ Intent: ${intent}`);
      const result: ToolCallResult<unknown> = {
        ok: false,
        reason: 'INVALID_PARAMS',
        message: `ไม่รองรับ Intent '${intent}'`,
      };
      await this.writeAuditLog(intent, context, result, Date.now() - startMs);
      return result;
    }
    let result: ToolCallResult<unknown>;
    try {
      result = await handler(context);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Tool Handler สำหรับ Intent '${intent}' เกิด exception: ${errMsg}`
      );
      result = {
        ok: false,
        reason: 'SERVICE_ERROR',
        message: 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง',
      };
    }
    const latencyMs = Date.now() - startMs;
    await this.writeAuditLog(intent, context, result, latencyMs);
    return result;
  }

  /**
   * คืน handler function สำหรับ Unit Test (ตรวจสอบว่ามี intent นั้นอยู่หรือไม่)
   */
  getHandler(intent: ServerIntent): ToolHandler | undefined {
    return this.handlerMap.get(intent);
  }

  /**
   * บันทึก Audit Log ทุก Tool Execution (ADR-023 FR-005)
   * ทำแบบ fire-and-forget เพื่อไม่บล็อก response
   */
  private async writeAuditLog(
    intent: string,
    context: ToolHandlerContext,
    result: ToolCallResult<unknown>,
    latencyMs: number
  ): Promise<void> {
    try {
      const log = this.auditLogRepo.create({
        publicId: uuidv7(),
        aiModel: 'tool-layer', // ระบุ layer ใน model field
        modelName: intent,
        processingTimeMs: latencyMs,
        status: result.ok ? AiAuditStatus.SUCCESS : AiAuditStatus.FAILED,
        errorMessage: result.ok ? undefined : result.reason,
        aiSuggestionJson: {
          intent,
          projectPublicId: context.projectPublicId,
          userPublicId: context.requestUser.publicId,
          params: context.params ?? {},
          ok: result.ok,
          reason: result.ok ? undefined : result.reason,
        },
      });
      await this.auditLogRepo.save(log);
    } catch (auditError: unknown) {
      // Audit log ล้มเหลวต้องไม่กระทบ response หลัก (ข้อผิดพลาดเป็น non-critical)
      this.logger.error(
        `เขียน Audit Log ล้มเหลว: ${(auditError as Error).message}`
      );
    }
  }
}
