// File: backend/src/modules/notification/notification.module.ts
// Change Log:
// - 2026-09-25: Feature 258 — wire Telegram services/controllers + delivery audit

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule'; // ✅ New

import { Notification } from './entities/notification.entity';
import { NotificationChannel } from './entities/notification-channel.entity';
import { NotificationDelivery } from './entities/notification-delivery.entity';
import { User } from '../user/entities/user.entity';
import { UserPreference } from '../user/entities/user-preference.entity';
import { SystemSetting } from '../ai/entities/system-setting.entity';
import { Project } from '../project/entities/project.entity';

import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationProcessor } from './notification.processor';
import { NotificationGateway } from './notification.gateway'; // ✅ New
import { NotificationCleanupService } from './notification-cleanup.service'; // ✅ New
import { TelegramBotService } from './telegram/telegram-bot.service';
import { TelegramSecretGuard } from './telegram/telegram-secret.guard';
import { TelegramLinkService } from './telegram/telegram-link.service';
import { TelegramWebhookController } from './telegram/telegram-webhook.controller';
import { UserTelegramController } from './telegram/user-telegram.controller';
import { UserTelegramAdminController } from './telegram/user-telegram-admin.controller';
import { NotificationChannelService } from './notification-channel.service';
import { NotificationChannelAdminController } from './notification-channel-admin.controller';
import { NotificationAdminController } from './notification-admin.controller';
import { NotificationDeliveryService } from './notification-delivery.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      NotificationChannel,
      NotificationDelivery,
      User,
      UserPreference,
      SystemSetting,
      Project,
    ]),
    BullModule.registerQueue({
      name: 'notifications',
    }),
    ScheduleModule.forRoot(), // ✅ New (ถ้ายังไม่ได้ import ใน AppModule)
    ConfigModule,
    // CommonModule ไม่ต้อง import — @Global() + export CryptoService อยู่แล้ว
    // (import ซ้ำสร้าง circular require: CommonModule→AiModule→…→NotificationModule)
    UserModule,
  ],
  controllers: [
    NotificationController,
    TelegramWebhookController, // Feature 258
    UserTelegramController, // Feature 258
    UserTelegramAdminController, // Feature 258 (T055)
    NotificationChannelAdminController, // Feature 258 (T039)
    NotificationAdminController, // Feature 258 (T054)
  ],
  providers: [
    NotificationService,
    NotificationProcessor,
    NotificationGateway, // ✅ New
    NotificationCleanupService, // ✅ New
    TelegramBotService, // Feature 258
    TelegramSecretGuard, // Feature 258
    TelegramLinkService, // Feature 258
    NotificationChannelService, // Feature 258
    NotificationDeliveryService, // Feature 258 (T053)
  ],
  exports: [
    NotificationService,
    TelegramBotService,
    NotificationChannelService,
    NotificationDeliveryService, // Feature 258
  ],
})
export class NotificationModule {}
