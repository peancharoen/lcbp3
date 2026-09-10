// File: backend/src/modules/ai/services/rag-text-segment.service.ts
// Change Log:
// - 2026-09-14: T058 เพิ่ม normalizeSection/normalizeSheet สำหรับ SECTION/SHEET segments (Feature 254, Phase 6 US4)
// - 2026-09-10: T025 rename RagSegmentationService → RagTextSegmentService, T026 extract chunking ออกไป RagChunkingService (Feature 254)
// - 2026-09-09: เพิ่ม TextSegment normalization และ 512-token/64-overlap chunking (Feature 254)

import { Injectable, Logger } from '@nestjs/common';
import { RagTextSegment } from '../interfaces/rag-attachment.types';

/** บริการสำหรับ normalize ข้อความและสร้าง page segments ก่อน chunking (ADR-034) */
@Injectable()
export class RagTextSegmentService {
  private readonly logger = new Logger(RagTextSegmentService.name);

  /** สร้าง TextSegment แบบ WHOLE_DOCUMENT จากข้อความเดียว */
  public normalizeWholeDocument(text: string): RagTextSegment {
    return {
      segmentType: 'WHOLE_DOCUMENT',
      text: this.normalizeWhitespace(text),
    };
  }

  /** สร้าง TextSegment แบบ PAGE จากข้อความหน้า */
  public normalizePage(
    pageNumber: number,
    text: string,
    sourceLocator?: string
  ): RagTextSegment {
    return {
      segmentType: 'PAGE',
      segmentNumber: pageNumber,
      segmentLabel: `Page ${pageNumber}`,
      sourceLocator,
      text: this.normalizeWhitespace(text),
    };
  }

  /**
   * สร้าง TextSegment แบบ SECTION จาก heading และเนื้อหา section
   * ใช้สำหรับเอกสารที่แบ่งตามหัวข้อ (เช่น Markdown, DOCX headings)
   */
  public normalizeSection(
    sectionNumber: number,
    heading: string,
    text: string,
    sourceLocator?: string
  ): RagTextSegment {
    return {
      segmentType: 'SECTION',
      segmentNumber: sectionNumber,
      segmentLabel: heading,
      sourceLocator,
      text: this.normalizeWhitespace(text),
    };
  }

  /**
   * สร้าง TextSegment แบบ SHEET จากเนื้อหา sheet ใน spreadsheet
   * ใช้สำหรับไฟล์ XLSX/ODS ที่แบ่งตาม worksheet
   */
  public normalizeSheet(
    sheetNumber: number,
    text: string,
    sourceLocator?: string
  ): RagTextSegment {
    return {
      segmentType: 'SHEET',
      segmentNumber: sheetNumber,
      segmentLabel: `Sheet ${sheetNumber}`,
      sourceLocator,
      text: this.normalizeWhitespace(text),
    };
  }

  /** ทำความสะอาด whitespace โดยรักษาโครงสร้างข้อความ */
  private normalizeWhitespace(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
