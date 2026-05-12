// File: src/modules/delegation/delegation.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Delegation } from './entities/delegation.entity';
import { User } from '../user/entities/user.entity';
import { DelegationService } from './delegation.service';
import { DelegationController } from './delegation.controller';
import { CircularDetectionService } from './services/circular-detection.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Delegation, User]),
    UserModule,
  ],
  providers: [DelegationService, CircularDetectionService],
  controllers: [DelegationController],
  exports: [DelegationService],
})
export class DelegationModule {}
