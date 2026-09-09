// File: backend/src/common/processors/document-side-effects.module.ts
// Change Log:
// - 2026-09-09: Module for DocumentSideEffectsProcessor. Deliberately NOT added to
//   CommonModule (where DOCUMENT_SIDE_EFFECTS_QUEUE's producer side lives) — CommonModule
//   is imported almost everywhere in this app, and this processor needs SearchModule/
//   AiModule/NotificationModule, which would risk exactly the class of circular
//   dependency already hit and fixed today (CommonModule <-> AiModule <->
//   AiToolModule). BullMQ supports registering the same named queue from multiple
//   modules independently (already the pattern for e.g. the 'ai-batch' queue,
//   registered separately in both ai.module.ts and migration.module.ts) — this
//   module registers DOCUMENT_SIDE_EFFECTS_QUEUE again purely for @InjectQueue/
//   @Processor wiring on the consumer side, same underlying Redis-backed queue.

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DOCUMENT_SIDE_EFFECTS_QUEUE } from '../services/document-side-effects.service';
import { DocumentSideEffectsProcessor } from './document-side-effects.processor';
import { SearchModule } from '../../modules/search/search.module';
import { AiModule } from '../../modules/ai/ai.module';
import { NotificationModule } from '../../modules/notification/notification.module';
import { Correspondence } from '../../modules/correspondence/entities/correspondence.entity';
import { CorrespondenceRevision } from '../../modules/correspondence/entities/correspondence-revision.entity';

@Module({
  imports: [
    BullModule.registerQueue({ name: DOCUMENT_SIDE_EFFECTS_QUEUE }),
    TypeOrmModule.forFeature([Correspondence, CorrespondenceRevision]),
    SearchModule,
    AiModule,
    NotificationModule,
  ],
  providers: [DocumentSideEffectsProcessor],
})
export class DocumentSideEffectsProcessorModule {}
