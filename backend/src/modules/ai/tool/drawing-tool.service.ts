// File: src/modules/ai/tool/drawing-tool.service.ts
// Change Log
// - 2026-05-19: สร้าง DrawingToolService — Tool Handler สำหรับ Intent GET_DRAWING (ADR-025, ADR-016, ADR-019).

import { Injectable, Logger } from '@nestjs/common';
import { AbilityFactory } from '../../../common/auth/casl/ability.factory';
import { ShopDrawingService } from '../../drawing/shop-drawing.service';
import { UuidResolverService } from '../../../common/services/uuid-resolver.service';
import { ToolCallResult } from './types/tool-call-result.type';
import { ToolHandlerContext } from './types/tool-handler-context.type';
import { DrawingToolResult } from './types/drawing-tool-result.type';

interface ShopDrawingTransformed {
  publicId: string;
  drawingNumber?: string;
  title?: string;
  status?: string;
  currentRevision?: {
    revisionLabel?: string;
  };
}

@Injectable()
export class DrawingToolService {
  private readonly logger = new Logger(DrawingToolService.name);

  constructor(
    private readonly shopDrawingService: ShopDrawingService,
    private readonly abilityFactory: AbilityFactory,
    private readonly uuidResolver: UuidResolverService
  ) {}

  /**
   * ดึงข้อมูล Drawing (Shop Drawing) สำหรับ LLM context
   * - ตรวจสอบสิทธิ์ด้วย CASL (ADR-016)
   * - คืนเฉพาะ publicId + metadata ตาม ADR-019
   * - จัดการ error แบบ Graceful Degradation (ADR-007)
   */
  async getDrawing(
    context: ToolHandlerContext
  ): Promise<ToolCallResult<DrawingToolResult[]>> {
    // ตรวจสอบสิทธิ์ด้วย CASL ก่อนดึงข้อมูล
    const ability = this.abilityFactory.createForUser(context.requestUser, {});
    if (!ability.can('read', 'drawing')) {
      this.logger.warn(
        `ผู้ใช้ ${context.requestUser.publicId} ไม่มีสิทธิ์อ่าน Drawing`
      );
      return {
        ok: false,
        reason: 'FORBIDDEN',
        message: 'คุณไม่มีสิทธิ์อ่านข้อมูล Drawing ในโครงการนี้',
      };
    }
    try {
      // ดึงข้อมูล Shop Drawing (ใช้ projectUuid ตาม ADR-019)
      const result = await this.shopDrawingService.findAll({
        projectUuid: context.projectPublicId,
        page: 1,
        limit: 20,
      });
      // Map ผลลัพธ์ไปยัง DrawingToolResult — ห้าม expose integer id (ADR-019)
      const data = result.data as unknown as ShopDrawingTransformed[];
      const toolResults: DrawingToolResult[] = data
        .filter((drawing) => drawing.publicId)
        .map((drawing) => {
          const latestRev = drawing.currentRevision;
          return {
            publicId: drawing.publicId,
            drawingNumber: drawing.drawingNumber ?? '',
            title: drawing.title ?? '',
            statusCode: drawing.status ?? 'UNKNOWN',
            drawingType: 'SHOP' as const,
            latestRevision: latestRev?.revisionLabel ?? null,
            contractPublicId: '', // เพิ่มภายหลังเมื่อ contract มี publicId
          };
        });
      return { ok: true, data: toolResults };
    } catch (error: unknown) {
      this.logger.error(
        `DrawingToolService.getDrawing เกิดข้อผิดพลาด: ${(error as Error).message}`
      );
      return {
        ok: false,
        reason: 'SERVICE_ERROR',
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูล Drawing กรุณาลองใหม่',
      };
    }
  }
}
