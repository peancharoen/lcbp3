// File: backend/src/modules/ai/services/rag-chunking.service.ts
// Change Log:
// - 2026-09-10: T026 extract chunking logic จาก RagSegmentationService มาเป็น RagChunkingService (Feature 254)

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v7 as uuidv7 } from 'uuid';
import {
  RagSegmentType,
  RagTextSegment,
} from '../interfaces/rag-attachment.types';

/** ผลลัพธ์ chunk ที่พร้อม persist ลง rag_attachment_chunks */
export interface RagChunkDraft {
  chunkPublicId: string;
  chunkIndex: number;
  content: string;
  sourcePageUuid: string;
  segmentType: RagSegmentType;
  segmentNumber?: number;
  segmentLabel?: string;
  sourceLocator?: string;
  startOffset: number;
  endOffset: number;
}

/** บริการสำหรับแบ่ง chunk ตาม ADR-034 (512 tokens / 64 overlap) */
@Injectable()
export class RagChunkingService {
  private readonly logger = new Logger(RagChunkingService.name);
  private readonly chunkSize: number;
  private readonly overlap: number;

  constructor(configService: ConfigService) {
    this.chunkSize = configService.get<number>('EMBEDDING_CHUNK_SIZE', 512);
    this.overlap = configService.get<number>('EMBEDDING_CHUNK_OVERLAP', 64);
  }

  /** แบ่ง segment ออกเป็น chunks ตามขนาด token ที่กำหนด พร้อม overlap */
  public chunkSegment(
    segment: RagTextSegment,
    pageUuid: string
  ): RagChunkDraft[] {
    const cleanText = segment.text;
    if (cleanText.length === 0) {
      return [];
    }

    const chunks: RagChunkDraft[] = [];
    let startIndex = 0;
    let chunkIndex = 0;

    while (startIndex < cleanText.length) {
      const endIndex = Math.min(startIndex + this.chunkSize, cleanText.length);
      const chunkText = cleanText.substring(startIndex, endIndex);

      chunks.push({
        chunkPublicId: uuidv7(),
        chunkIndex,
        content: chunkText,
        sourcePageUuid: pageUuid,
        segmentType: segment.segmentType,
        segmentNumber: segment.segmentNumber,
        segmentLabel: segment.segmentLabel,
        sourceLocator: segment.sourceLocator,
        startOffset: startIndex,
        endOffset: endIndex,
      });

      if (endIndex >= cleanText.length) {
        break;
      }
      startIndex += this.chunkSize - this.overlap;
      chunkIndex += 1;
    }

    this.logger.debug(
      `Segmented ${segment.segmentType} into ${chunks.length} chunks (size=${this.chunkSize}, overlap=${this.overlap})`
    );
    return chunks;
  }
}
