// File: src/modules/ai/tool/ai-tool.module.ts
// Change Log
// - 2026-05-19: สร้าง AiToolModule — submodule สำหรับ AI Tool Layer (ADR-025).

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiToolRegistryService } from './ai-tool-registry.service';
import { RfaToolService } from './rfa-tool.service';
import { DrawingToolService } from './drawing-tool.service';
import { TransmittalToolService } from './transmittal-tool.service';
import { AiAuditLog } from '../entities/ai-audit-log.entity';
import { RfaModule } from '../../rfa/rfa.module';
import { DrawingModule } from '../../drawing/drawing.module';
import { TransmittalModule } from '../../transmittal/transmittal.module';
import { CaslModule } from '../../../common/auth/casl/casl.module';
import { CommonModule } from '../../../common/common.module';

/**
 * AiToolModule — จัดการ Tool Registry และ Tool Service Handlers
 * import โดย AiModule เพื่อใช้ AiToolRegistryService ใน AI Gateway (ADR-025)
 */
@Module({
  imports: [
    // Entity สำหรับ Audit Logging (FR-005)
    TypeOrmModule.forFeature([AiAuditLog]),
    // Domain Modules สำหรับ Tool Services
    RfaModule,
    DrawingModule,
    TransmittalModule,
    // CASL สำหรับ Authorization enforcement ใน Tool Handlers
    CaslModule,
    // CommonModule สำหรับ UuidResolverService
    CommonModule,
  ],
  providers: [
    AiToolRegistryService,
    RfaToolService,
    DrawingToolService,
    TransmittalToolService,
  ],
  exports: [AiToolRegistryService],
})
export class AiToolModule {}
