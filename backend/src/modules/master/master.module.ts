// File: src/modules/master/master.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MasterService } from './master.service';
import { MasterController } from './master.controller';

// Import Entities
import { Tag } from './entities/tag.entity';
import { CorrespondenceType } from '../correspondence/entities/correspondence-type.entity';
import { CorrespondenceStatus } from '../correspondence/entities/correspondence-status.entity';
import { RfaType } from '../rfa/entities/rfa-type.entity';
import { RfaStatusCode } from '../rfa/entities/rfa-status-code.entity';
import { RfaApproveCode } from '../rfa/entities/rfa-approve-code.entity';
import { CirculationStatusCode } from '../circulation/entities/circulation-status-code.entity';

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
    ]),
  ],
  controllers: [MasterController],
  providers: [MasterService],
  exports: [MasterService], // Export เผื่อ Module อื่นต้องใช้
})
export class MasterModule {}
