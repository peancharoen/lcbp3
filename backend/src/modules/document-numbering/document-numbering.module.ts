import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import {
  makeCounterProvider,
  makeGaugeProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';

import { DocumentNumberingService } from './services/document-numbering.service';
import { DocumentNumberingController } from './controllers/document-numbering.controller';
import { DocumentNumberingAdminController } from './controllers/document-numbering-admin.controller';
import { NumberingMetricsController } from './controllers/numbering-metrics.controller';

import { DocumentNumberFormat } from './entities/document-number-format.entity';
import { DocumentNumberCounter } from './entities/document-number-counter.entity';
import { DocumentNumberReservation } from './entities/document-number-reservation.entity';
import { DocumentNumberAudit } from './entities/document-number-audit.entity';
import { DocumentNumberError } from './entities/document-number-error.entity';

import { CounterService } from './services/counter.service';
import { ReservationService } from './services/reservation.service';
import { FormatService } from './services/format.service';
import { DocumentNumberingLockService } from './services/document-numbering-lock.service';
import { TemplateService } from './services/template.service';
import { AuditService } from './services/audit.service';
import { MetricsService } from './services/metrics.service';
import { ManualOverrideService } from './services/manual-override.service';

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
  controllers: [
    DocumentNumberingController,
    DocumentNumberingAdminController,
    NumberingMetricsController,
  ],
  providers: [
    DocumentNumberingService,
    CounterService,
    ReservationService,
    FormatService,
    DocumentNumberingLockService,
    TemplateService,
    AuditService,
    MetricsService,
    ManualOverrideService,
    // Prometheus Providers
    makeCounterProvider({
      name: 'numbering_sequences_total',
      help: 'Total number of sequences generated',
    }),
    makeGaugeProvider({
      name: 'numbering_sequence_utilization',
      help: 'Current utilization of sequence space',
    }),
    makeHistogramProvider({
      name: 'numbering_lock_wait_seconds',
      help: 'Time spent waiting for locks',
    }),
    makeCounterProvider({
      name: 'numbering_lock_failures_total',
      help: 'Total number of lock acquisition failures',
    }),
  ],
  exports: [
    DocumentNumberingService,
    CounterService,
    ReservationService,
    FormatService,
    DocumentNumberingLockService,
    TemplateService,
    AuditService,
    MetricsService,
  ],
})
export class DocumentNumberingModule {}
