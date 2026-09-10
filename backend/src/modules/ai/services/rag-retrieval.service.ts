// File: backend/src/modules/ai/services/rag-retrieval.service.ts
// Change Log:
// - 2026-09-09: เพิ่ม retrieval service สำหรับ ACTIVE-generation guard + citation (Feature 254)
// - 2026-09-10: T039+T041 — split ACTIVE validation ไป RagRetrievalGuardService และ citation mapping ไป RagCitationService (delegation)

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { RagAttachmentChunk } from '../entities/rag-attachment-chunk.entity';
import { AiQdrantService } from '../qdrant.service';
import { RagCitationDto } from '../dto/rag-attachment.dto';
import { RagRetrievalGuardService } from './rag-retrieval-guard.service';
import { RagCitationService } from './rag-citation.service';

/** ผลลัพธ์การค้นหา RAG พร้อม citations */
export interface RagRetrievalResult {
  citations: RagCitationDto[];
  totalFound: number;
  skippedStale: number;
}

/**
 * บริการสำหรับค้นหา RAG ที่บังคับ ACTIVE generation เท่านั้น
 * - ประสานงานระหว่าง Qdrant search, ACTIVE-generation guard และ citation mapping
 * - delegate การตรวจสอบ ACTIVE ให้ RagRetrievalGuardService (T039)
 * - delegate การสร้าง citation ให้ RagCitationService (T041)
 */
@Injectable()
export class RagRetrievalService {
  private readonly logger = new Logger(RagRetrievalService.name);

  constructor(
    @InjectRepository(RagAttachmentChunk)
    private readonly chunkRepository: Repository<RagAttachmentChunk>,
    private readonly qdrantService: AiQdrantService,
    private readonly guardService: RagRetrievalGuardService,
    private readonly citationService: RagCitationService
  ) {}

  /**
   * ค้นหา RAG ด้วย dense vector
   * - บังคับ projectPublicId filter (ADR-023A)
   * - กรองเฉพาะ chunks ที่อยู่ใน ACTIVE generation เท่านั้น
   * - กรองตาม classification ของผู้ใช้
   */
  public async retrieve(
    projectPublicId: string,
    denseVector: number[],
    topK = 10,
    allowedClassifications?: Array<'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL'>
  ): Promise<RagRetrievalResult> {
    if (!projectPublicId) {
      throw new Error('RAG_RETRIEVAL_PROJECT_SCOPE_REQUIRED');
    }

    // 1. ค้นหาใน Qdrant ด้วย project filter
    const rawResults = await this.qdrantService.search(
      projectPublicId,
      denseVector,
      topK * 2
    );

    if (rawResults.length === 0) {
      return { citations: [], totalFound: 0, skippedStale: 0 };
    }

    // 2. กรองเฉพาะ chunks ที่อยู่ใน ACTIVE generation (delegate ไป RagRetrievalGuardService)
    const activeResults =
      await this.guardService.filterActiveChunksFromResults(rawResults);

    if (activeResults.length === 0) {
      return {
        citations: [],
        totalFound: rawResults.length,
        skippedStale: rawResults.length,
      };
    }

    // 3. ดึง chunk records จาก MariaDB
    const activeChunkIds = activeResults
      .map((r) => r.payload?.chunk_public_id as string | undefined)
      .filter((id): id is string => Boolean(id));

    if (activeChunkIds.length === 0) {
      return {
        citations: [],
        totalFound: rawResults.length,
        skippedStale: rawResults.length,
      };
    }

    const chunks = await this.chunkRepository.find({
      where: { chunkPublicId: In(activeChunkIds) },
    });
    const chunkMap = new Map(chunks.map((c) => [c.chunkPublicId, c]));

    // 4. สร้าง citations พร้อมกรอง classification (delegate ไป RagCitationService)
    const { citations, skippedStale } = this.citationService.mapToCitations(
      activeResults,
      chunkMap,
      topK,
      allowedClassifications
    );

    return {
      citations,
      totalFound: rawResults.length,
      skippedStale,
    };
  }
}
