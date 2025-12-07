import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule'; // ✅ Import
import { FileStorageService } from './file-storage.service.js';
import { FileStorageController } from './file-storage.controller.js';
import { FileCleanupService } from './file-cleanup.service.js'; // ✅ Import
import { Attachment } from './entities/attachment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Attachment]),
    ScheduleModule.forRoot(), // ✅ เปิดใช้งาน Cron Job],
  ],
  controllers: [FileStorageController],
  providers: [
    FileStorageService,
    FileCleanupService, // ✅ Register Provider
  ],
  exports: [FileStorageService], // Export ให้ Module อื่น (เช่น Correspondence) เรียกใช้ตอน Commit
})
export class FileStorageModule {}
