// File: src/modules/ai/services/embedding.service.ts
// Change Log
// - 2026-05-15: เพิ่ม EmbeddingService สำหรับ full-document chunked embedding ตาม ADR-023A T021.

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OllamaService } from './ollama.service';
import { AiQdrantService } from '../qdrant.service';
import { OcrService } from './ocr.service';

export interface EmbeddingChunk {
  chunkIndex: number;
  text: string;
  pageNumber?: number;
}

export interface EmbeddingResult {
  success: boolean;
  chunksEmbedded: number;
  error?: string;
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
    private readonly ocrService: OcrService
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
   * สร้าง embedding สำหรับเอกสารทั้งฉบับ:
   * 1. ดึงข้อความ full-doc (ใช้ extractedText หรือ OCR)
   * 2. Chunk text 512 tokens / 64 overlap
   * 3. Generate embedding ต่อ chunk ด้วย nomic-embed-text
   * 4. Upsert ไป Qdrant พร้อม project isolation
   */
  async embedDocument(
    pdfPath: string,
    documentPublicId: string,
    projectPublicId: string,
    extractedText?: string
  ): Promise<EmbeddingResult> {
    try {
      // 1. ดึงข้อความจาก PDF (ใช้ extractedText ถ้ามี หรือเรียก OCR)
      let fullText = extractedText;
      if (!fullText) {
        const ocrResult = await this.ocrService.detectAndExtract({
          pdfPath,
          extractedText: '',
          extractedChars: 0,
        });
        fullText = ocrResult.text;
      }

      if (!fullText || fullText.trim().length === 0) {
        this.logger.warn(`No text extracted from document ${documentPublicId}`);
        return {
          success: false,
          chunksEmbedded: 0,
          error: 'No text extracted',
        };
      }

      // 2. Chunk text
      const chunks = this.chunkText(fullText);
      this.logger.log(
        `Document ${documentPublicId} split into ${chunks.length} chunks`
      );

      // 3. Generate embedding และ upsert ไป Qdrant
      const points = [];
      for (const chunk of chunks) {
        try {
          const embedding = await this.ollamaService.generateEmbedding(
            chunk.text
          );
          points.push({
            id: `${documentPublicId}-${chunk.chunkIndex}`,
            vector: embedding,
            payload: {
              document_public_id: documentPublicId,
              chunk_index: chunk.chunkIndex,
              page_number: chunk.pageNumber,
              chunk_text: chunk.text,
              embedded_at: new Date().toISOString(),
            },
          });
        } catch (err) {
          this.logger.error(
            `Failed to embed chunk ${chunk.chunkIndex} for document ${documentPublicId}`,
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

      // 4. Upsert ไป Qdrant พร้อม project isolation
      await this.qdrantService.upsert(projectPublicId, points);

      this.logger.log(
        `Successfully embedded ${points.length} chunks for document ${documentPublicId} in project ${projectPublicId}`
      );

      return { success: true, chunksEmbedded: points.length };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Embedding failed for document ${documentPublicId}: ${errorMsg}`
      );
      return { success: false, chunksEmbedded: 0, error: errorMsg };
    }
  }

  /**
   * Chunk text ด้วย overlap
   * - chunkSize: 512 characters (approximate token equivalent)
   * - overlap: 64 characters
   */
  private chunkText(text: string): EmbeddingChunk[] {
    const chunks: EmbeddingChunk[] = [];
    const cleanText = text.replace(/\s+/g, ' ').trim();
    const textLength = cleanText.length;

    let startIndex = 0;
    let chunkIndex = 0;

    while (startIndex < textLength) {
      const endIndex = Math.min(startIndex + this.chunkSize, textLength);
      const chunkText = cleanText.substring(startIndex, endIndex);

      chunks.push({
        chunkIndex,
        text: chunkText,
        pageNumber: undefined, // TODO: Extract page numbers if available
      });

      startIndex += this.chunkSize - this.overlap;
      chunkIndex += 1;
    }

    return chunks;
  }
}
