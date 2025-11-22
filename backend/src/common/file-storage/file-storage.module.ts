import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileStorageService } from './file-storage.service.js';
import { FileStorageController } from './file-storage.controller.js';
import { Attachment } from './entities/attachment.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Attachment])],
  controllers: [FileStorageController],
  providers: [FileStorageService],
  exports: [FileStorageService], // Export ให้ Module อื่น (เช่น Correspondence) เรียกใช้ตอน Commit
})
export class FileStorageModule {}
