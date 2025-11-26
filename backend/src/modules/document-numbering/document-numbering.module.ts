// File: src/modules/document-numbering/document-numbering.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { DocumentNumberingService } from './document-numbering.service';
import { DocumentNumberFormat } from './entities/document-number-format.entity';
import { DocumentNumberCounter } from './entities/document-number-counter.entity';

// Master Entities ที่ต้องใช้ Lookup
import { Project } from '../project/entities/project.entity';
import { Organization } from '../project/entities/organization.entity';
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import { Discipline } from '../master/entities/discipline.entity';
import { CorrespondenceSubType } from '../correspondence/entities/correspondence-sub-type.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      DocumentNumberFormat,
      DocumentNumberCounter,
      Project,
      Organization,
      CorrespondenceType,
      Discipline,
      CorrespondenceSubType,
    ]),
  ],
  providers: [DocumentNumberingService],
  exports: [DocumentNumberingService],
})
export class DocumentNumberingModule {}
