import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_AI_VECTOR_DELETION } from '../common/constants/queue.constants';
import { AiVectorDeletionJobPayload } from '../ai/ai-queue.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { createHash } from 'crypto';

import { QdrantService } from './qdrant.service';
import { EmbeddingService } from './embedding.service';
import { TyphoonService } from './typhoon.service';
import { IngestionService } from './ingestion.service';
import { DocumentChunk } from './entities/document-chunk.entity';
import { RagQueryDto } from './dto/rag-query.dto';
import { RagResponseDto, RagCitation } from './dto/rag-response.dto';

const CACHE_TTL_SECONDS = 300;
const PROMPT_CONTEXT_LIMIT = 3000;

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly qdrant: QdrantService,
    private readonly embedding: EmbeddingService,
    private readonly typhoon: TyphoonService,
    private readonly ingestionService: IngestionService,
    @InjectRepository(DocumentChunk)
    private readonly chunkRepo: Repository<DocumentChunk>,
    @InjectRedis() private readonly redis: Redis,
    @InjectQueue(QUEUE_AI_VECTOR_DELETION)
    private readonly vectorDeletionQueue: Queue<AiVectorDeletionJobPayload>
  ) {}

  async query(
    dto: RagQueryDto,
    userPermissions: string[]
  ): Promise<RagResponseDto> {
    const { question, projectPublicId } = dto;

    const classificationCeiling =
      this.deriveClassificationCeiling(userPermissions);
    const isConfidential = classificationCeiling === 'CONFIDENTIAL';

    if (!this.qdrant.isReady()) {
      throw new ServiceUnavailableException('RAG_NOT_READY');
    }

    const cacheKey = this.buildCacheKey(
      question,
      projectPublicId,
      classificationCeiling
    );

    if (!isConfidential) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as RagResponseDto;
        parsed.cachedAt = new Date().toISOString();
        return parsed;
      }
    }

    const queryVector = await this.embedding.embed(question);
    const topK = 20;

    const results = await this.qdrant.hybridSearch(
      queryVector,
      projectPublicId,
      classificationCeiling,
      topK
    );

    const reranked = results.sort((a, b) => b.score - a.score).slice(0, 5);

    const context = this.buildContext(reranked);

    const safeQuestion = this.typhoon.sanitizeInput(question);
    const prompt = this.buildPrompt(safeQuestion, context);

    const { answer, usedFallbackModel } = await this.typhoon.generate(
      prompt,
      isConfidential
    );

    const citations: RagCitation[] = reranked.map((r) => ({
      chunkId: r.chunkId,
      docNumber: r.docNumber,
      docType: r.docType,
      revision: r.revision,
      snippet: r.contentPreview.slice(0, 200),
      score: r.score,
    }));

    const confidence = reranked.length > 0 ? reranked[0].score : 0;

    const response: RagResponseDto = {
      answer,
      citations,
      confidence,
      usedFallbackModel,
    };

    if (!isConfidential) {
      await this.redis.setex(
        cacheKey,
        CACHE_TTL_SECONDS,
        JSON.stringify(response)
      );
    }

    return response;
  }

  async getStatus(
    attachmentPublicId: string
  ): Promise<{ ragStatus: string; chunkCount: number }> {
    const chunkCount = await this.chunkRepo.count({
      where: { documentId: attachmentPublicId },
    });

    const result = await this.chunkRepo.manager.query<{ rag_status: string }[]>(
      `SELECT rag_status FROM attachments WHERE public_id = ? LIMIT 1`,
      [attachmentPublicId]
    );

    const ragStatus = result[0]?.rag_status ?? 'PENDING';
    return { ragStatus, chunkCount };
  }

  async reIngest(attachmentPublicId: string): Promise<void> {
    const statusResult = await this.chunkRepo.manager.query<
      { rag_status: string; file_path: string }[]
    >(
      `SELECT rag_status, file_path FROM attachments WHERE public_id = ? LIMIT 1`,
      [attachmentPublicId]
    );

    const current = statusResult[0]?.rag_status;
    if (current !== 'FAILED') {
      throw new BadRequestException(
        `Cannot re-ingest: current status is '${current ?? 'unknown'}', expected 'FAILED'`
      );
    }

    const sample = await this.chunkRepo.findOne({
      where: { documentId: attachmentPublicId },
    });

    await this.chunkRepo.delete({ documentId: attachmentPublicId });

    try {
      await this.qdrant.deleteByDocumentId(attachmentPublicId);
    } catch (err) {
      this.logger.error(
        `Qdrant delete failed for ${attachmentPublicId} — continuing`,
        err instanceof Error ? err.stack : String(err)
      );
    }

    await this.chunkRepo.manager.query(
      `UPDATE attachments SET rag_status = 'PENDING', rag_last_error = NULL WHERE public_id = ?`,
      [attachmentPublicId]
    );

    if (sample) {
      await this.ingestionService.enqueue({
        attachmentPublicId,
        filePath: statusResult[0]?.file_path ?? '',
        docType: sample.docType,
        docNumber: sample.docNumber,
        revision: sample.revision,
        projectCode: sample.projectCode,
        projectPublicId: sample.projectPublicId,
        classification: sample.classification,
      });
    }
  }

  async initCollection(): Promise<void> {
    await this.qdrant.onModuleInit();
  }

  async deleteVectors(
    attachmentPublicId: string,
    requestedByUserPublicId = 'system'
  ): Promise<void> {
    // ลบ DocumentChunk ออกจาก DB แบบ synchronous (รวดเร็ว ไม่มี external dependency)
    await this.chunkRepo.delete({ documentId: attachmentPublicId });
    // T028: เปลี่ยน Qdrant deletion เป็น async ผ่าน BullMQ เพื่อ eventual consistency (FR-008)
    await this.vectorDeletionQueue.add(
      'delete-document-vectors',
      { documentPublicId: attachmentPublicId, requestedByUserPublicId },
      {
        jobId: attachmentPublicId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      }
    );
    this.logger.log(
      `Vector deletion queued for attachment=${attachmentPublicId}`
    );
  }

  buildContext(
    results: Array<{
      docType: string;
      docNumber: string | null;
      revision: string | null;
      contentPreview: string;
    }>
  ): string {
    let context = '';
    for (const r of results) {
      const header = `[${r.docType}${r.docNumber ? ` - ${r.docNumber}` : ''}${r.revision ? ` - ${r.revision}` : ''}]`;
      const snippet = `${header}\n${r.contentPreview}\n\n`;
      if ((context + snippet).length > PROMPT_CONTEXT_LIMIT) break;
      context += snippet;
    }
    return context.trim();
  }

  private buildPrompt(question: string, context: string): string {
    return [
      'คุณเป็นผู้ช่วยผู้เชี่ยวชาญด้านเอกสารโครงการก่อสร้าง',
      'ตอบคำถามโดยอ้างอิงจากเอกสารที่ให้มาเท่านั้น ห้ามตอบจากความรู้ทั่วไป',
      'หากข้อมูลในเอกสารไม่เพียงพอ ให้แจ้งว่า "ไม่พบข้อมูลในเอกสารที่ระบุ"',
      '',
      '=== เอกสารอ้างอิง ===',
      context,
      '',
      '=== คำถาม ===',
      question,
    ].join('\n');
  }

  private buildCacheKey(
    question: string,
    projectPublicId: string,
    classificationCeiling: string
  ): string {
    const raw = `${question}|${projectPublicId}|${classificationCeiling}`;
    return `rag:query:${createHash('sha256').update(raw).digest('hex')}`;
  }

  private deriveClassificationCeiling(
    permissions: string[]
  ): 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' {
    if (
      permissions.includes('system.manage_all') ||
      permissions.includes('document.view_confidential')
    ) {
      return 'CONFIDENTIAL';
    }
    return 'INTERNAL';
  }
}
