// File: src/modules/distribution/distribution.module.ts
// Change Log
// - 2026-05-14: Register ResponseCode repository for Distribution Matrix publicId resolution.
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { DistributionMatrix } from './entities/distribution-matrix.entity';
import { DistributionRecipient } from './entities/distribution-recipient.entity';
import { DistributionService } from './distribution.service';
import { DistributionMatrixService } from './distribution-matrix.service';
import { DistributionController } from './distribution.controller';
import { DistributionProcessor } from './processors/distribution.processor';
import { ApprovalListenerService } from './services/approval-listener.service';
import { TransmittalCreatorService } from './services/transmittal-creator.service';
import { QUEUE_DISTRIBUTION } from '../common/constants/queue.constants';
import { NotificationModule } from '../notification/notification.module';
import { Project } from '../project/entities/project.entity';
import { ResponseCode } from '../response-code/entities/response-code.entity';
import { DocumentNumberingModule } from '../document-numbering/document-numbering.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DistributionMatrix,
      DistributionRecipient,
      Project,
      ResponseCode,
    ]),
    BullModule.registerQueue({ name: QUEUE_DISTRIBUTION }),
    NotificationModule,
    DocumentNumberingModule,
  ],
  providers: [
    DistributionService,
    DistributionMatrixService,
    DistributionProcessor,
    ApprovalListenerService,
    TransmittalCreatorService,
  ],
  controllers: [DistributionController],
  exports: [
    DistributionService,
    DistributionMatrixService,
    ApprovalListenerService,
  ],
})
export class DistributionModule {}
