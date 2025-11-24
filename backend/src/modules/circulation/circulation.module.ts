import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Circulation } from './entities/circulation.entity';
import { CirculationRouting } from './entities/circulation-routing.entity';
import { CirculationStatusCode } from './entities/circulation-status-code.entity';

import { CirculationService } from './circulation.service';
import { CirculationController } from './circulation.controller';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Circulation,
      CirculationRouting,
      CirculationStatusCode,
    ]),
    UserModule,
  ],
  controllers: [CirculationController],
  providers: [CirculationService],
  exports: [CirculationService],
})
export class CirculationModule {}
