import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule'; // ✅ Import
import { FileStorageService } from './file-storage.service';
import { FileStorageController } from './file-storage.controller';
import { FileCleanupService } from './file-cleanup.service'; // ✅ Import
import { Attachment } from './entities/attachment.entity';
import { UserModule } from '../../modules/user/user.module';
import {
  QUEUE_AI_BATCH,
  QUEUE_AI_REALTIME,
} from '../../modules/common/constants/queue.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([Attachment]),
    ScheduleModule.forRoot(), // ✅ เปิดใช้งาน Cron Job],
    UserModule,
    BullModule.registerQueue(
      { name: 'rag-ocr' },
      { name: QUEUE_AI_REALTIME },
      { name: QUEUE_AI_BATCH }
    ),
  ],
  controllers: [FileStorageController],
  providers: [
    FileStorageService,
    FileCleanupService, // ✅ Register Provider
  ],
  exports: [FileStorageService], // Export ให้ Module อื่น (เช่น Correspondence) เรียกใช้ตอน Commit
})
export class FileStorageModule {}
