// File: src/modules/response-code/response-code.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResponseCode } from './entities/response-code.entity';
import { ResponseCodeRule } from './entities/response-code-rule.entity';
import { ResponseCodeService } from './response-code.service';
import { ResponseCodeController } from './response-code.controller';
import { ImplicationsService } from './services/implications.service';
import { NotificationTriggerService } from './services/notification-trigger.service';
import { MatrixManagementService } from './services/matrix-management.service';
import { InheritanceService } from './services/inheritance.service';
import { User } from '../user/entities/user.entity';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ResponseCode, ResponseCodeRule, User]),
    NotificationModule,
  ],
  providers: [
    ResponseCodeService,
    ImplicationsService,
    NotificationTriggerService,
    MatrixManagementService,
    InheritanceService,
  ],
  controllers: [ResponseCodeController],
  exports: [
    ResponseCodeService,
    ImplicationsService,
    NotificationTriggerService,
    MatrixManagementService,
    InheritanceService,
  ],
})
export class ResponseCodeModule {}
