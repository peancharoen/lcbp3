// File: src/modules/tags/tags.module.ts
// Change Log:
// - 2026-05-22: เริ่มต้นสร้าง TagsModule สำหรับจัดการแท็กโครงการและจัดหมวดหมู่เอกสารโต้ตอบตาม ADR-028

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tag } from './entities/tag.entity';
import { CorrespondenceTag } from './entities/correspondence-tag.entity';
import { TagsService } from './tags.service';
import { TagsController } from './tags.controller';

/**
 * โมดูลสำหรับจัดการแท็กโครงการและเอกสารโต้ตอบ (Tags & Correspondence Links)
 */
@Module({
  imports: [TypeOrmModule.forFeature([Tag, CorrespondenceTag])],
  controllers: [TagsController],
  providers: [TagsService],
  exports: [TagsService],
})
export class TagsModule {}
