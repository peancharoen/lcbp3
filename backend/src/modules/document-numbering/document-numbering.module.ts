// File: src/modules/document-numbering/document-numbering.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { DocumentNumberingService } from './services/document-numbering.service';
import { DocumentNumberingController } from './controllers/document-numbering.controller';
import { DocumentNumberingAdminController } from './controllers/document-numbering-admin.controller';
import { DocumentNumberFormat } from './entities/document-number-format.entity';
import { DocumentNumberCounter } from './entities/document-number-counter.entity';
import { DocumentNumberReservation } from './entities/document-number-reservation.entity';
import { DocumentNumberAudit } from './entities/document-number-audit.entity';
import { DocumentNumberError } from './entities/document-number-error.entity';
import { CounterService } from './services/counter.service';
import { ReservationService } from './services/reservation.service';
import { FormatService } from './services/format.service';

// Master Entities ที่ต้องใช้ Lookup
import { Project } from '../project/entities/project.entity';
import { Organization } from '../organization/entities/organization.entity';
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
      DocumentNumberReservation,
      DocumentNumberAudit,
      DocumentNumberError,
      Project,
      Organization,
      CorrespondenceType,
      Discipline,
      CorrespondenceSubType,
    ]),
  ],
  controllers: [DocumentNumberingController, DocumentNumberingAdminController],
  providers: [
    DocumentNumberingService,
    CounterService,
    ReservationService,
    FormatService,
  ],
  exports: [
    DocumentNumberingService,
    CounterService,
    ReservationService,
    FormatService,
  ],
})
export class DocumentNumberingModule {}
