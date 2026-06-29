// File: src/modules/response-code/response-code.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../../common/entities/audit-log.entity';
import { ResponseCode } from './entities/response-code.entity';
import { ResponseCodeRule } from './entities/response-code-rule.entity';
import { ResponseCodeService } from './response-code.service';
import { ResponseCodeController } from './response-code.controller';
import { ResponseCodeAuditService } from './services/audit.service';
import { ImplicationsService } from './services/implications.service';
import { NotificationTriggerService } from './services/notification-trigger.service';
import { MatrixManagementService } from './services/matrix-management.service';
import { InheritanceService } from './services/inheritance.service';
import { User } from '../user/entities/user.entity';
import { NotificationModule } from '../notification/notification.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ResponseCode, ResponseCodeRule, User, AuditLog]),
    NotificationModule,
    UserModule,
  ],
  providers: [
    ResponseCodeService,
    ResponseCodeAuditService,
    ImplicationsService,
    NotificationTriggerService,
    MatrixManagementService,
    InheritanceService,
  ],
  controllers: [ResponseCodeController],
  exports: [
    ResponseCodeService,
    ResponseCodeAuditService,
    ImplicationsService,
    NotificationTriggerService,
    MatrixManagementService,
    InheritanceService,
    TypeOrmModule,
  ],
})
export class ResponseCodeModule {}
