// File: src/modules/document-numbering/document-numbering.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { DocumentNumberingService } from './document-numbering.service';
import { DocumentNumberingController } from './document-numbering.controller';
import { DocumentNumberFormat } from './entities/document-number-format.entity';
import { DocumentNumberCounter } from './entities/document-number-counter.entity';
import { DocumentNumberAudit } from './entities/document-number-audit.entity'; // [P0-4]
import { DocumentNumberError } from './entities/document-number-error.entity'; // [P0-4]

// Master Entities ที่ต้องใช้ Lookup
import { Project } from '../project/entities/project.entity';
import { Organization } from '../project/entities/organization.entity';
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import { Discipline } from '../master/entities/discipline.entity';
import { CorrespondenceSubType } from '../correspondence/entities/correspondence-sub-type.entity';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    ConfigModule,
    UserModule,
    TypeOrmModule.forFeature([
      DocumentNumberFormat,
      DocumentNumberCounter,
      DocumentNumberAudit, // [P0-4]
      DocumentNumberError, // [P0-4]
      Project,
      Organization,
      CorrespondenceType,
      Discipline,
      CorrespondenceSubType,
    ]),
  ],
  controllers: [DocumentNumberingController],
  providers: [DocumentNumberingService],
  exports: [DocumentNumberingService],
})
export class DocumentNumberingModule {}
