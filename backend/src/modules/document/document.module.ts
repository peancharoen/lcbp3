// File: backend/src/modules/document/document.module.ts
// Change Log:
// - 2026-09-07: Create DocumentModule for cross-type bulk operations (Feature 253 — T087)

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { BulkOperationsProcessor } from './processors/bulk-operations.processor';
import { CorrespondenceModule } from '../correspondence/correspondence.module';
import { RfaModule } from '../rfa/rfa.module';
import { TransmittalModule } from '../transmittal/transmittal.module';
import { DrawingModule } from '../drawing/drawing.module';
import { CirculationModule } from '../circulation/circulation.module';
import { CommonModule } from '../../common/common.module';
import { QUEUE_BULK_OPERATIONS } from '../../modules/common/constants/queue.constants';
import { UserModule } from '../user/user.module';

/**
 * Module สำหรับ cross-type document operations
 * รวม Bulk Cancel / Tag / Export (Feature 253)
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_BULK_OPERATIONS }),
    CorrespondenceModule,
    RfaModule,
    TransmittalModule,
    DrawingModule,
    CirculationModule,
    CommonModule,
    UserModule, // สำหรับ RbacGuard (ต้องการ UserService) — security fix 2026-09-09
  ],
  controllers: [DocumentController],
  providers: [DocumentService, BulkOperationsProcessor],
  exports: [DocumentService],
})
export class DocumentModule {}
