// File: backend/src/modules/ai/services/rag-citation.service.ts
// Change Log:
// - 2026-09-10: Split จาก rag-retrieval.service.ts — user-safe citation mapping (Feature 254, Phase 4 US2, T041)

import { Injectable } from '@nestjs/common';
import { RagAttachmentChunk } from '../entities/rag-attachment-chunk.entity';
import { AiVectorSearchResult } from '../qdrant.service';
import { RagCitationDto } from '../dto/rag-attachment.dto';

/** ผลลัพธ์การแปลง citations */
export interface RagCitationMappingResult {
  citations: RagCitationDto[];
  skippedStale: number;
}

/**
 * บริการแปลง raw chunks + scores เป็น citation objects ที่ปลอดภัยสำหรับผู้ใช้
 * - ไม่เปิดเผย generationUuid ใน output (user-safe)
 * - กรองตาม classification ที่ผู้ใช้มีสิทธิ์เข้าถึง
 * - จำกัดจำนวน citations ตาม topK
 */
@Injectable()
export class RagCitationService {
  /**
   * แปลง Qdrant search results เป็น citations
   * - ใช้ chunkMap เพื่อ join ข้อมูล chunk จาก MariaDB
   * - กรองตาม allowedClassifications (ถ้าระบุ)
   * - หยุดเก็บเมื่อถึง topK
   * @param rawResults ผลลัพธ์ Qdrant ที่กรอง ACTIVE แล้ว
   * @param chunkMap map ของ chunkPublicId → RagAttachmentChunk
   * @param topK จำนวน citations สูงสุด
   * @param allowedClassifications classification ที่อนุญาต (optional)
   * @returns citations และจำนวนที่ถูกข้าม
   */
  public mapToCitations(
    rawResults: AiVectorSearchResult[],
    chunkMap: Map<string, RagAttachmentChunk>,
    topK: number,
    allowedClassifications?: Array<'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL'>
  ): RagCitationMappingResult {
    const allowedSet = allowedClassifications
      ? new Set(allowedClassifications)
      : null;

    const citations: RagCitationDto[] = [];
    let skippedStale = 0;

    for (const result of rawResults) {
      const chunkPublicId = result.payload?.chunk_public_id as
        | string
        | undefined;
      if (!chunkPublicId) {
        skippedStale += 1;
        continue;
      }

      const chunk = chunkMap.get(chunkPublicId);
      if (!chunk) {
        skippedStale += 1;
        continue;
      }

      if (allowedSet && !allowedSet.has(chunk.classification)) {
        skippedStale += 1;
        continue;
      }

      citations.push({
        chunkPublicId: chunk.chunkPublicId,
        attachmentPublicId: chunk.attachmentUuid,
        ownerType: chunk.ownerType,
        ownerPublicId: chunk.ownerPublicId,
        content: chunk.content,
        segmentType: chunk.segmentType,
        segmentNumber: chunk.segmentNumber ?? undefined,
        segmentLabel: chunk.segmentLabel ?? undefined,
        sourceLocator: chunk.sourceLocator ?? undefined,
        score: result.score,
      });

      if (citations.length >= topK) break;
    }

    return { citations, skippedStale };
  }
}
