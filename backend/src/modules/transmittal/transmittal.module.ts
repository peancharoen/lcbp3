import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transmittal } from './entities/transmittal.entity';
import { TransmittalItem } from './entities/transmittal-item.entity';
import { Correspondence } from '../correspondence/entities/correspondence.entity';
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import { CorrespondenceStatus } from '../correspondence/entities/correspondence-status.entity';
import { CorrespondenceRevision } from '../correspondence/entities/correspondence-revision.entity';
import { TransmittalService } from './transmittal.service';
import { TransmittalController } from './transmittal.controller';
import { DocumentNumberingModule } from '../document-numbering/document-numbering.module';
import { ProjectModule } from '../project/project.module';
import { UserModule } from '../user/user.module';
import { SearchModule } from '../search/search.module';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transmittal,
      TransmittalItem,
      Correspondence,
      CorrespondenceType,
      CorrespondenceStatus,
      CorrespondenceRevision,
    ]),
    DocumentNumberingModule,
    ProjectModule,
    UserModule,
    SearchModule,
    WorkflowEngineModule,
  ],
  controllers: [TransmittalController],
  providers: [TransmittalService],
  exports: [TransmittalService],
})
export class TransmittalModule {}
