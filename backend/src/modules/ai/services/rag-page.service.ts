// File: backend/src/modules/ai/services/rag-page.service.ts
// Change Log:
// - 2026-09-14: T059 (Feature 254 Phase 6 US4) — สร้าง RagPageService สำหรับ
//   rag_attachment_pages persistence พร้อม generation-scoped normalized offsets

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { RagAttachmentPage } from '../entities/rag-attachment-page.entity';
import { RagTextSegment } from '../interfaces/rag-attachment.types';

/** ผลลัพธ์การสร้าง page record */
export interface RagPageRecord {
  pageUuid: string;
  segmentType: RagTextSegment['segmentType'];
  segmentNumber?: number;
  segmentLabel?: string;
  sourceLocator?: string;
  normalizedStartOffset: string;
  normalizedEndOffset: string;
}

/**
 * บริการสำหรับ persistence ของ rag_attachment_pages
 * - สร้าง page records สำหรับแต่ละ TextSegment ใน generation
 * - คำนวณ normalized offsets แบบ generation-scoped (ต่อเนื่องข้าม segments)
 * - บันทึกลง database ผ่าน TypeORM repository
 */
@Injectable()
export class RagPageService {
  private readonly logger = new Logger(RagPageService.name);

  constructor(
    @InjectRepository(RagAttachmentPage)
    private readonly pageRepository: Repository<RagAttachmentPage>
  ) {}

  /**
   * สร้างและบันทึก page records สำหรับ TextSegments ใน generation
   * normalized offsets คำนวณแบบ generation-scoped (ต่อเนื่องข้าน segments)
   * @param generationUuid UUID ของ generation
   * @param attachmentUuid UUID ของ attachment
   * @param segments รายการ TextSegments ที่ normalize แล้ว
   * @returns รายการ page records ที่สร้างและบันทึกแล้ว
   */
  public async persistSegments(
    generationUuid: string,
    attachmentUuid: string,
    segments: RagTextSegment[]
  ): Promise<RagPageRecord[]> {
    const records: RagAttachmentPage[] = [];
    let currentOffset = 0;

    for (const segment of segments) {
      const pageUuid = uuidv7();
      const startOffset = currentOffset;
      const endOffset = currentOffset + segment.text.length;

      const page = this.pageRepository.create({
        pageUuid,
        generationUuid,
        attachmentUuid,
        segmentType: segment.segmentType,
        segmentNumber: segment.segmentNumber,
        segmentLabel: segment.segmentLabel,
        sourceLocator: segment.sourceLocator,
        normalizedText: segment.text,
        normalizedStartOffset: String(startOffset),
        normalizedEndOffset: String(endOffset),
      });
      records.push(page);
      currentOffset = endOffset;
    }

    if (records.length > 0) {
      await this.pageRepository.save(records);
    }

    this.logger.debug(
      `Persisted ${records.length} page records for generation ${generationUuid}`
    );

    return records.map((r) => ({
      pageUuid: r.pageUuid,
      segmentType: r.segmentType,
      segmentNumber: r.segmentNumber ?? undefined,
      segmentLabel: r.segmentLabel ?? undefined,
      sourceLocator: r.sourceLocator ?? undefined,
      normalizedStartOffset: r.normalizedStartOffset,
      normalizedEndOffset: r.normalizedEndOffset,
    }));
  }

  /**
   * ดึง page records ของ generation หนึ่ง
   * @param generationUuid UUID ของ generation
   * @returns รายการ page records เรียงตาม normalizedStartOffset
   */
  public async findByGeneration(
    generationUuid: string
  ): Promise<RagAttachmentPage[]> {
    return this.pageRepository.find({
      where: { generationUuid },
      order: { normalizedStartOffset: 'ASC' },
    });
  }

  /**
   * ลบ page records ของ generation หนึ่ง (สำหรับ cleanup)
   * @param generationUuid UUID ของ generation
   */
  public async deleteByGeneration(generationUuid: string): Promise<void> {
    await this.pageRepository.delete({ generationUuid });
    this.logger.debug(`Deleted page records for generation ${generationUuid}`);
  }
}
