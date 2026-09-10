// File: backend/src/modules/ai/services/rag-embedding.service.ts
// Change Log:
// - 2026-09-10: T028 เพิ่ม RagEmbeddingService สำหรับ BGE-M3 dense+sparse embedding และ Qdrant payload construction (Feature 254)

import { Injectable, Logger } from '@nestjs/common';
import { OcrService } from './ocr.service';
import type { RagChunkDraft } from './rag-chunking.service';

/** ผลลัพธ์ BGE-M3 embedding (dense + sparse) */
export interface RagEmbeddingResult {
  dense: number[];
  sparse: { indices: number[]; values: number[] };
  device?: string;
}

/** Context สำหรับสร้าง Qdrant payload */
export interface RagQdrantPayloadContext {
  generationUuid: string;
  attachmentPublicId: string;
  ownerType: string;
  ownerPublicId: string;
  projectPublicId: string;
  classification: string;
}

/** Qdrant point ที่พร้อม upsert */
export interface RagQdrantPoint {
  id: string;
  vector: {
    bge_dense: number[];
    bge_sparse: { indices: number[]; values: number[] };
  };
  payload: Record<string, unknown>;
}

/**
 * บริการสำหรับ BGE-M3 dense+sparse embedding และ Qdrant payload construction
 * แยก embedding logic ออกจาก RagAttachmentIngestProcessor เพื่อให้ test ได้ง่าย (ADR-034)
 */
@Injectable()
export class RagEmbeddingService {
  private readonly logger = new Logger(RagEmbeddingService.name);

  constructor(private readonly ocrService: OcrService) {}

  /** เรียก Sidecar /embed เพื่อทำ BGE-M3 (Dense + Sparse) embedding */
  public async embedChunk(content: string): Promise<RagEmbeddingResult> {
    const result = await this.ocrService.embedViaSidecar(content);
    return {
      dense: result.dense,
      sparse: result.sparse,
      device: result.device,
    };
  }

  /** สร้าง Qdrant point จาก chunk draft + embedding result + payload context */
  public buildQdrantPoint(
    draft: RagChunkDraft,
    embedResult: RagEmbeddingResult,
    context: RagQdrantPayloadContext
  ): RagQdrantPoint {
    return {
      id: draft.chunkPublicId,
      vector: {
        bge_dense: embedResult.dense,
        bge_sparse: embedResult.sparse,
      },
      payload: {
        chunk_public_id: draft.chunkPublicId,
        generation_uuid: context.generationUuid,
        attachment_public_id: context.attachmentPublicId,
        owner_type: context.ownerType,
        owner_public_id: context.ownerPublicId,
        project_public_id: context.projectPublicId,
        chunk_index: draft.chunkIndex,
        classification: context.classification,
        segment_type: draft.segmentType,
        segment_number: draft.segmentNumber ?? null,
        source_locator: draft.sourceLocator ?? null,
        start_offset: draft.startOffset,
        end_offset: draft.endOffset,
      },
    };
  }

  /** Embed และสร้าง Qdrant point ในครั้งเดียว */
  public async embedAndBuildPoint(
    draft: RagChunkDraft,
    context: RagQdrantPayloadContext
  ): Promise<RagQdrantPoint> {
    const embedResult = await this.embedChunk(draft.content);
    return this.buildQdrantPoint(draft, embedResult, context);
  }
}
