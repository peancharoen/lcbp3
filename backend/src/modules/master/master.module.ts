// File: src/modules/master/master.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MasterService } from './master.service';
import { MasterController } from './master.controller';

// Import Entities เดิม
import { Tag } from './entities/tag.entity';
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import { CorrespondenceStatus } from '../correspondence/entities/correspondence-status.entity';
import { RfaType } from '../rfa/entities/rfa-type.entity';
import { RfaStatusCode } from '../rfa/entities/rfa-status-code.entity';
import { RfaApproveCode } from '../rfa/entities/rfa-approve-code.entity';
import { CirculationStatusCode } from '../circulation/entities/circulation-status-code.entity';

// [New v1.4.4] Import Entities ใหม่ตาม Req 6B และ T2.6
import { Discipline } from './entities/discipline.entity';
import { CorrespondenceSubType } from '../correspondence/entities/correspondence-sub-type.entity';
// Entity นี้อาจจะอยู่ใน module document-numbering แต่นำมาใช้ที่นี่เพื่อการจัดการ Master Data
import { DocumentNumberFormat } from '../document-numbering/entities/document-number-format.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tag,
      CorrespondenceType,
      CorrespondenceStatus,
      RfaType,
      RfaStatusCode,
      RfaApproveCode,
      CirculationStatusCode,
      // [New] Register Repositories
      Discipline,
      CorrespondenceSubType,
      DocumentNumberFormat,
    ]),
  ],
  controllers: [MasterController],
  providers: [MasterService],
  exports: [MasterService],
})
export class MasterModule {}
