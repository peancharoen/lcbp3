import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule'; // ✅ New

import { Notification } from './entities/notification.entity';
import { User } from '../user/entities/user.entity';
import { UserPreference } from '../user/entities/user-preference.entity';

import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationProcessor } from './notification.processor';
import { NotificationGateway } from './notification.gateway'; // ✅ New
import { NotificationCleanupService } from './notification-cleanup.service'; // ✅ New
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, User, UserPreference]),
    BullModule.registerQueue({
      name: 'notifications',
    }),
    ScheduleModule.forRoot(), // ✅ New (ถ้ายังไม่ได้ import ใน AppModule)
    ConfigModule,
    UserModule,
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationProcessor,
    NotificationGateway, // ✅ New
    NotificationCleanupService, // ✅ New
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
