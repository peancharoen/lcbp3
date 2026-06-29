// File: src/modules/ai/tool/rfa-tool.service.ts
// Change Log
// - 2026-05-19: สร้าง RfaToolService — Tool Handler สำหรับ Intent GET_RFA (ADR-025, ADR-016, ADR-019).

import { Injectable, Logger } from '@nestjs/common';
import { AbilityFactory } from '../../../common/auth/casl/ability.factory';
import { RfaService } from '../../rfa/rfa.service';
import { UuidResolverService } from '../../../common/services/uuid-resolver.service';
import { ToolCallResult } from './types/tool-call-result.type';
import { ToolHandlerContext } from './types/tool-handler-context.type';
import { RfaToolResult } from './types/rfa-tool-result.type';

@Injectable()
export class RfaToolService {
  private readonly logger = new Logger(RfaToolService.name);

  constructor(
    private readonly rfaService: RfaService,
    private readonly abilityFactory: AbilityFactory,
    private readonly uuidResolver: UuidResolverService
  ) {}

  /**
   * ดึงข้อมูล RFA สำหรับ LLM context
   * - ตรวจสอบสิทธิ์ด้วย CASL (ADR-016)
   * - คืนเฉพาะ publicId + business codes ตาม ADR-019
   * - จัดการ error แบบ Graceful Degradation (ADR-007)
   */
  async getRfa(
    context: ToolHandlerContext
  ): Promise<ToolCallResult<RfaToolResult[]>> {
    // ตรวจสอบสิทธิ์ด้วย CASL ก่อนดึงข้อมูล
    const ability = this.abilityFactory.createForUser(context.requestUser, {});
    if (!ability.can('read', 'rfa')) {
      this.logger.warn(
        `ผู้ใช้ ${context.requestUser.publicId} ไม่มีสิทธิ์อ่าน RFA`
      );
      return {
        ok: false,
        reason: 'FORBIDDEN',
        message: 'คุณไม่มีสิทธิ์อ่านข้อมูล RFA ในโครงการนี้',
      };
    }
    try {
      // แปลง projectPublicId → internal project id (ADR-019)
      const internalProjectId = await this.uuidResolver.resolveProjectId(
        context.projectPublicId
      );
      // ดึงข้อมูล RFA จาก RfaService
      const result = await this.rfaService.findAll(
        {
          projectId: internalProjectId,
          revisionStatus: 'CURRENT',
          limit: 20,
          page: 1,
        },
        context.requestUser
      );
      // Map ผลลัพธ์ไปยัง RfaToolResult — ห้าม expose integer id (ADR-019)
      const toolResults: RfaToolResult[] = result.data
        .filter((rfa) => rfa.publicId)
        .map((rfa) => {
          const currentRevision = rfa.revisions?.[0];
          const rfaRevision = currentRevision?.rfaRevision;
          return {
            publicId: rfa.publicId as string,
            rfaNumber: rfa.correspondence?.correspondenceNumber ?? '',
            revisionCode: currentRevision?.revisionLabel ?? '0',
            statusCode: rfaRevision?.statusCode?.statusCode ?? 'UNKNOWN',
            drawingCount: rfaRevision?.items?.length ?? 0,
            submittedAt: currentRevision?.issuedDate
              ? currentRevision.issuedDate.toISOString()
              : null,
            respondedAt: rfaRevision?.approvedDate
              ? new Date(
                  rfaRevision.approvedDate as string | number | Date
                ).toISOString()
              : null,
            contractPublicId: '', // Contract publicId — ถ้า contract entity มี publicId ให้เพิ่มทีหลัง
          };
        });
      return { ok: true, data: toolResults };
    } catch (error: unknown) {
      this.logger.error(
        `RfaToolService.getRfa เกิดข้อผิดพลาด: ${(error as Error).message}`
      );
      return {
        ok: false,
        reason: 'SERVICE_ERROR',
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูล RFA กรุณาลองใหม่',
      };
    }
  }
}
