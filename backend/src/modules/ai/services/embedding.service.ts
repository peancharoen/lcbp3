// File: backend/src/modules/ai/services/embedding.service.ts
// Change Log
// - 2026-05-15: เพิ่ม EmbeddingService สำหรับ full-document chunked embedding ตาม ADR-023A T021.
// - 2026-06-05: ปรับปรุงเป็น Hybrid Embedding และเพิ่ม Semantic Chunking ผ่าน typhoon2.5 (T025-T027)
// - 2026-06-11: US3 - เพิ่มการคืนค่า device (cpu/gpu) จาก embedding

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OllamaService } from './ollama.service';
import { AiQdrantService } from '../qdrant.service';
import { OcrService } from './ocr.service';
import { AiPromptsService } from '../prompts/ai-prompts.service';

export interface EmbeddingChunk {
  chunkIndex: number;
  text: string;
  pageNumber?: number;
}

export interface EmbeddingResult {
  success: boolean;
  chunksEmbedded: number;
  error?: string;
  device?: string;
}

/** บริการสร้าง embedding สำหรับ full-document RAG (ADR-023A) */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly chunkSize: number;
  private readonly overlap: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly ollamaService: OllamaService,
    private readonly qdrantService: AiQdrantService,
    private readonly ocrService: OcrService,
    private readonly aiPromptsService: AiPromptsService
  ) {
    this.chunkSize = this.configService.get<number>(
      'EMBEDDING_CHUNK_SIZE',
      512
    );
    this.overlap = this.configService.get<number>(
      'EMBEDDING_CHUNK_OVERLAP',
      64
    );
  }

  /**
   * สร้าง hybrid embedding สำหรับเอกสารทั้งฉบับ:
   * 1. ใช้ Semantic Chunking (ผ่าน LLM) เป็นหลัก พร้อม Fallback เป็นแบบ fixed-size
   * 2. เรียก Sidecar /embed เพื่อแปลงแต่ละ chunk เป็น Dense (1024 dims) + Sparse vector
   * 3. ลบ points เก่าของเอกสารใน Qdrant
   * 4. Upsert points ใหม่เก็บครบ 11 fields
   */
  async embedDocument(
    projectPublicId: string,
    documentPublicId: string,
    correspondenceNumber: string,
    docType: string,
    statusCode: string,
    revisionNumber: number,
    subject: string,
    documentDate?: string,
    ocrText?: string
  ): Promise<EmbeddingResult> {
    try {
      if (!ocrText || ocrText.trim().length === 0) {
        this.logger.warn(
          `No OCR text provided for document ${documentPublicId}`
        );
        return {
          success: false,
          chunksEmbedded: 0,
          error: 'No OCR text provided',
        };
      }
      const chunks = await this.semanticChunkTextWithFallback(ocrText);
      this.logger.log(
        `Document ${documentPublicId} split into ${chunks.length} chunks`
      );
      const points = [];
      let usedDevice = 'gpu';
      for (const [idx, chunk] of chunks.entries()) {
        try {
          const embedResult = await this.ocrService.embedViaSidecar(chunk.text);
          if (embedResult.device === 'cpu') {
            usedDevice = 'cpu';
          }
          points.push({
            id: `${documentPublicId}-${idx}`,
            vector: {
              bge_dense: embedResult.dense,
              bge_sparse: embedResult.sparse,
            },
            payload: {
              doc_public_id: documentPublicId,
              project_public_id: projectPublicId,
              doc_number: correspondenceNumber,
              doc_type: docType,
              status_code: statusCode,
              revision_number: revisionNumber,
              subject: subject,
              document_date: documentDate || null,
              chunk_topic: chunk.topic,
              chunk_index: idx,
              chunk_text: chunk.text,
              embedded_at: new Date().toISOString(),
            },
          });
        } catch (err) {
          this.logger.error(
            `Failed to embed chunk ${idx} for document ${documentPublicId}`,
            err instanceof Error ? err.message : String(err)
          );
        }
      }
      if (points.length === 0) {
        return {
          success: false,
          chunksEmbedded: 0,
          error: 'All chunks failed to embed',
        };
      }
      await this.qdrantService.deleteByDocumentPublicId(
        projectPublicId,
        documentPublicId
      );
      await this.qdrantService.upsert(projectPublicId, points);
      this.logger.log(
        `Successfully embedded ${points.length} chunks for document ${documentPublicId} in project ${projectPublicId}`
      );
      return {
        success: true,
        chunksEmbedded: points.length,
        device: usedDevice,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Embedding failed for document ${documentPublicId}: ${errorMsg}`
      );
      return { success: false, chunksEmbedded: 0, error: errorMsg };
    }
  }

  /**
   * แบ่งข้อความโดยใช้ typhoon2.5 และ Prompt 'rag_chunking' (T025, T026)
   * หากล้มเหลวหรือ LLM ไม่ตอบกลับในรูปแบบแท็ก <chunk> ให้ fallback เป็นแบบ fixed-size
   */
  private async semanticChunkTextWithFallback(
    ocrText: string
  ): Promise<Array<{ topic: string; text: string }>> {
    try {
      this.logger.log('Attempting semantic chunking via typhoon2.5...');
      // ดึง prompt จาก ai_prompts ที่เป็น active version
      const resolved = await this.aiPromptsService.resolveActive(
        'rag_chunking',
        ocrText
      );

      // เรียก LLM
      const llmOutput = await this.ollamaService.generate(
        resolved.resolvedPrompt
      );

      // ดึงและวิเคราะห์ข้อความภายในแท็ก <chunk topic="...">
      const parsed = this.parseChunkTags(llmOutput);
      if (parsed.length > 0) {
        this.logger.log(
          `Semantic chunking succeeded: split into ${parsed.length} chunks.`
        );
        return parsed;
      }
      this.logger.warn(
        'No valid <chunk> tags found in LLM output, falling back to fixed-size chunking.'
      );
    } catch (err: unknown) {
      this.logger.warn(
        `Semantic chunking failed, falling back to fixed-size chunking: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // Fallback: ใช้การแบ่ง chunk แบบ Fixed-size
    return this.fixedSizeChunk(ocrText, this.chunkSize, this.overlap);
  }

  /** แบ่งข้อความตามขนาดคงที่ (Fixed-size Chunking) (FR-005) */
  private fixedSizeChunk(
    text: string,
    chunkSize: number,
    overlap: number
  ): Array<{ topic: string; text: string }> {
    const chunks: Array<{ topic: string; text: string }> = [];
    const cleanText = text.replace(/\s+/g, ' ').trim();
    const textLength = cleanText.length;

    let startIndex = 0;
    let chunkIndex = 0;

    while (startIndex < textLength) {
      const endIndex = Math.min(startIndex + chunkSize, textLength);
      const chunkText = cleanText.substring(startIndex, endIndex);

      chunks.push({
        topic: `ส่วนที่ ${chunkIndex + 1}`,
        text: chunkText,
      });

      startIndex += chunkSize - overlap;
      chunkIndex += 1;
    }

    return chunks;
  }

  /** ประมวลผลดึงค่า regex <chunk topic="...">... </chunk> (T026) */
  private parseChunkTags(
    llmOutput: string
  ): Array<{ topic: string; text: string }> {
    const chunks: Array<{ topic: string; text: string }> = [];
    const regex = /<chunk\s+topic="([^"]*)"\s*>([\s\S]*?)<\/chunk\s*>/gi;
    let match;
    while ((match = regex.exec(llmOutput)) !== null) {
      const topic = match[1]?.trim() || 'ทั่วไป';
      const text = match[2]?.trim();
      if (text) {
        chunks.push({ topic, text });
      }
    }
    return chunks;
  }
}
