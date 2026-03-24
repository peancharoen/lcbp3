import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CorrespondenceController } from './correspondence.controller';
import { CorrespondenceService } from './correspondence.service';
import { CorrespondenceWorkflowService } from './correspondence-workflow.service';
import { DueDateReminderService } from './due-date-reminder.service';

// Entities
import { Correspondence } from './entities/correspondence.entity';
import { CorrespondenceRevision } from './entities/correspondence-revision.entity';
import { CorrespondenceType } from './entities/correspondence-type.entity';
import { CorrespondenceStatus } from './entities/correspondence-status.entity';
import { CorrespondenceReference } from './entities/correspondence-reference.entity';
import { CorrespondenceRecipient } from './entities/correspondence-recipient.entity';
import { CorrespondenceTag } from './entities/correspondence-tag.entity';
import { Organization } from '../organization/entities/organization.entity';

// Dependent Modules
import { DocumentNumberingModule } from '../document-numbering/document-numbering.module';
import { JsonSchemaModule } from '../json-schema/json-schema.module';
import { UserModule } from '../user/user.module';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { SearchModule } from '../search/search.module';
import { FileStorageModule } from '../../common/file-storage/file-storage.module';
import { NotificationModule } from '../notification/notification.module';

/**
 * CorrespondenceModule
 *
 * NOTE: RoutingTemplate and RoutingTemplateStep have been deprecated.
 * All workflow operations now use the Unified Workflow Engine.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Correspondence,
      CorrespondenceRevision,
      CorrespondenceType,
      CorrespondenceStatus,
      CorrespondenceReference,
      CorrespondenceRecipient,
      CorrespondenceTag,
      Organization,
    ]),
    DocumentNumberingModule,
    JsonSchemaModule,
    UserModule,
    WorkflowEngineModule,
    SearchModule,
    FileStorageModule,
    NotificationModule,
  ],
  controllers: [CorrespondenceController],
  providers: [
    CorrespondenceService,
    CorrespondenceWorkflowService,
    DueDateReminderService,
  ],
  exports: [CorrespondenceService, CorrespondenceWorkflowService],
})
export class CorrespondenceModule {}
