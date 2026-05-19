// File: src/modules/ai/tool/transmittal-tool.service.ts
// Change Log
// - 2026-05-19: สร้าง TransmittalToolService — Tool Handler สำหรับ Intent GET_TRANSMITTAL (ADR-025, ADR-016, ADR-019).

import { Injectable, Logger } from '@nestjs/common';
import { AbilityFactory } from '../../../common/auth/casl/ability.factory';
import { TransmittalService } from '../../transmittal/transmittal.service';
import { UuidResolverService } from '../../../common/services/uuid-resolver.service';
import { ToolCallResult } from './types/tool-call-result.type';
import { ToolHandlerContext } from './types/tool-handler-context.type';
import { TransmittalToolResult } from './types/transmittal-tool-result.type';

@Injectable()
export class TransmittalToolService {
  private readonly logger = new Logger(TransmittalToolService.name);

  constructor(
    private readonly transmittalService: TransmittalService,
    private readonly abilityFactory: AbilityFactory,
    private readonly uuidResolver: UuidResolverService
  ) {}

  /**
   * ดึงข้อมูล Transmittal สำหรับ LLM context
   * - ตรวจสอบสิทธิ์ด้วย CASL (ADR-016)
   * - คืนเฉพาะ publicId + business codes ตาม ADR-019
   * - จัดการ error แบบ Graceful Degradation (ADR-007)
   */
  async getTransmittal(
    context: ToolHandlerContext
  ): Promise<ToolCallResult<TransmittalToolResult[]>> {
    // ตรวจสอบสิทธิ์ด้วย CASL ก่อนดึงข้อมูล
    const ability = this.abilityFactory.createForUser(context.requestUser, {});
    if (!ability.can('read', 'transmittal')) {
      this.logger.warn(
        `ผู้ใช้ ${context.requestUser.publicId} ไม่มีสิทธิ์อ่าน Transmittal`
      );
      return {
        ok: false,
        reason: 'FORBIDDEN',
        message: 'คุณไม่มีสิทธิ์อ่านข้อมูล Transmittal ในโครงการนี้',
      };
    }
    try {
      // แปลง projectPublicId → internal project id (ADR-019)
      const internalProjectId = await this.uuidResolver.resolveProjectId(
        context.projectPublicId
      );
      // ดึงข้อมูล Transmittal
      const result = await this.transmittalService.findAll({
        projectId: internalProjectId,
        page: 1,
        limit: 20,
      });
      // Map ผลลัพธ์ไปยัง TransmittalToolResult — ห้าม expose integer id (ADR-019)
      const toolResults: TransmittalToolResult[] = result.data
        .filter((t) => t.correspondence?.publicId)
        .map((t) => {
          const currentRevision = t.correspondence?.revisions?.[0];
          return {
            publicId: t.correspondence.publicId,
            transmittalNumber: t.correspondence?.correspondenceNumber ?? '',
            statusCode: currentRevision?.status?.statusCode ?? 'UNKNOWN',
            subject: currentRevision?.subject ?? '',
            issuedAt: currentRevision?.issuedDate
              ? currentRevision.issuedDate.toISOString()
              : null,
            projectPublicId: context.projectPublicId,
          };
        });
      return { ok: true, data: toolResults };
    } catch (error: unknown) {
      this.logger.error(
        `TransmittalToolService.getTransmittal เกิดข้อผิดพลาด: ${(error as Error).message}`
      );
      return {
        ok: false,
        reason: 'SERVICE_ERROR',
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูล Transmittal กรุณาลองใหม่',
      };
    }
  }
}
